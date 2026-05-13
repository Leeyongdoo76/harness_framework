"""
.claude/settings.json 에 등록된 hook 들의 동작 검증.

- guard.py (PreToolUse, matcher=Bash) : stdin JSON 의 tool_input.command 를 검사
- stop_check.py (Stop)               : 프로젝트 부트스트랩 상태에 따른 분기

표준 라이브러리(unittest)만으로 실행할 수 있다. pytest 불필요.

    python -m unittest scripts/test_hooks.py -v
    python scripts/test_hooks.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

import guard  # noqa: E402
import stop_check  # noqa: E402


# ---------------------------------------------------------------------------
# guard.py — 위험 패턴 단위 테스트 (find_violation 직접 호출)
# ---------------------------------------------------------------------------

class GuardPatternTests(unittest.TestCase):
    """find_violation 단위 테스트. subprocess 안 거치고 빠르게 패턴만 검증."""

    # --- 통과해야 하는 케이스 ---

    def test_empty_command_passes(self):
        self.assertIsNone(guard.find_violation(""))

    def test_ls_passes(self):
        self.assertIsNone(guard.find_violation("ls -la"))

    def test_git_status_passes(self):
        self.assertIsNone(guard.find_violation("git status"))

    def test_git_push_normal_passes(self):
        self.assertIsNone(guard.find_violation("git push origin main"))

    def test_force_with_lease_passes(self):
        """--force-with-lease 는 안전한 force push 변종이므로 통과."""
        self.assertIsNone(guard.find_violation("git push --force-with-lease origin main"))

    def test_remove_item_without_force_passes(self):
        """단순 Remove-Item 은 통과. 재귀+강제 조합만 차단."""
        self.assertIsNone(guard.find_violation("Remove-Item ./tmp.txt"))

    def test_rm_without_force_passes(self):
        """rm -r 만, rm -f 만은 통과. -rf 조합만 차단."""
        self.assertIsNone(guard.find_violation("rm -r ./empty_dir"))
        self.assertIsNone(guard.find_violation("rm ./file.txt"))

    # --- 차단해야 하는 케이스 ---

    def test_rm_rf_blocked(self):
        self.assertIsNotNone(guard.find_violation("rm -rf /"))

    def test_rm_rf_reverse_order_blocked(self):
        self.assertIsNotNone(guard.find_violation("rm -fr /tmp/junk"))

    def test_rm_long_form_blocked(self):
        self.assertIsNotNone(guard.find_violation("rm -rf ./dist"))

    def test_remove_item_recurse_force_blocked(self):
        self.assertIsNotNone(guard.find_violation("Remove-Item -Recurse -Force C:\\foo"))

    def test_remove_item_force_recurse_blocked(self):
        """플래그 순서가 반대여도 차단해야 한다."""
        self.assertIsNotNone(guard.find_violation("Remove-Item -Force -Recurse C:\\foo"))

    def test_git_push_force_blocked(self):
        self.assertIsNotNone(guard.find_violation("git push --force origin main"))

    def test_git_push_short_f_blocked(self):
        self.assertIsNotNone(guard.find_violation("git push -f origin main"))

    def test_git_reset_hard_blocked(self):
        self.assertIsNotNone(guard.find_violation("git reset --hard HEAD~1"))

    def test_git_clean_force_blocked(self):
        self.assertIsNotNone(guard.find_violation("git clean -fd"))

    def test_git_branch_force_delete_blocked(self):
        self.assertIsNotNone(guard.find_violation("git branch -D feature/old"))

    def test_git_checkout_discard_all_blocked(self):
        self.assertIsNotNone(guard.find_violation("git checkout -- ."))

    def test_drop_table_blocked(self):
        self.assertIsNotNone(guard.find_violation("DROP TABLE users"))

    def test_drop_table_case_insensitive(self):
        self.assertIsNotNone(guard.find_violation("drop table users"))

    def test_truncate_table_blocked(self):
        self.assertIsNotNone(guard.find_violation("TRUNCATE TABLE users"))

    def test_mkfs_blocked(self):
        self.assertIsNotNone(guard.find_violation("mkfs.ext4 /dev/sda1"))

    def test_dd_if_blocked(self):
        self.assertIsNotNone(guard.find_violation("dd if=/dev/zero of=/tmp/x"))

    def test_format_volume_blocked(self):
        self.assertIsNotNone(guard.find_violation("Format-Volume D:"))

    # --- Codex 리뷰에서 지적된 false negative 회귀 방지 ---

    def test_rm_long_form_recursive_force_blocked(self):
        """rm --recursive --force ./x — 단축이 아닌 long form 도 차단."""
        self.assertIsNotNone(guard.find_violation("rm --recursive --force ./x"))

    def test_rm_long_form_reverse_order_blocked(self):
        self.assertIsNotNone(guard.find_violation("rm --force --recursive ./x"))

    def test_powershell_alias_rmdir_blocked(self):
        self.assertIsNotNone(guard.find_violation("rmdir -Recurse -Force ./x"))

    def test_powershell_alias_ri_blocked(self):
        self.assertIsNotNone(guard.find_violation("ri -r -f ./x"))

    def test_powershell_alias_del_blocked(self):
        self.assertIsNotNone(guard.find_violation("del -Recurse -Force ./x"))

    def test_powershell_alias_rd_blocked(self):
        self.assertIsNotNone(guard.find_violation("rd -r -Force ./x"))

    def test_del_in_other_context_passes(self):
        """word boundary 가 잡아주므로 --delete 의 'del' 부분은 false positive 안 됨."""
        self.assertIsNone(guard.find_violation("git push --delete origin feature"))

    def test_git_restore_dot_blocked(self):
        self.assertIsNotNone(guard.find_violation("git restore ."))

    def test_git_restore_staged_dot_blocked(self):
        self.assertIsNotNone(guard.find_violation("git restore --staged ."))

    def test_git_restore_single_file_passes(self):
        """단일 파일 restore 는 안전한 일상 작업."""
        self.assertIsNone(guard.find_violation("git restore foo.txt"))

    def test_dd_if_with_spaces_blocked(self):
        """dd if = (공백 포함 변형) 도 차단."""
        self.assertIsNotNone(guard.find_violation("dd if = /dev/zero of=/tmp/x"))
        self.assertIsNotNone(guard.find_violation("dd if =/dev/zero of=/tmp/x"))

    # --- 인코딩 회귀 방지 (_force_utf8_stderr 가 제거되면 깨져야 한다) ---

    def test_force_utf8_stderr_is_called_from_main(self):
        import inspect
        src = inspect.getsource(guard.main)
        self.assertIn("_force_utf8_stderr", src,
                      "guard.main 이 _force_utf8_stderr 를 호출해야 한다 (Windows cp949 깨짐 회귀 방지)")


# ---------------------------------------------------------------------------
# guard.py — 엔드투엔드 (실제 stdin 입력으로 subprocess 호출)
# ---------------------------------------------------------------------------

class GuardE2ETests(unittest.TestCase):
    """실제 Claude Code 가 보내는 모양의 JSON 으로 subprocess 호출."""

    def _run(self, payload: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "guard.py")],
            input=payload,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

    def test_empty_stdin_passes(self):
        r = self._run("")
        self.assertEqual(r.returncode, 0)
        self.assertEqual(r.stderr, "")

    def test_invalid_json_fails_open(self):
        """입력이 JSON 이 아니면 차단하지 않는다 (fail-open)."""
        r = self._run("not valid json {{")
        self.assertEqual(r.returncode, 0)

    def test_missing_tool_input_passes(self):
        r = self._run(json.dumps({"tool_name": "Bash"}))
        self.assertEqual(r.returncode, 0)

    def test_empty_command_passes(self):
        r = self._run(json.dumps({"tool_input": {"command": ""}}))
        self.assertEqual(r.returncode, 0)

    def test_safe_command_passes(self):
        r = self._run(json.dumps({"tool_input": {"command": "ls -la"}}))
        self.assertEqual(r.returncode, 0)
        self.assertEqual(r.stderr, "")

    def test_rm_rf_blocked_with_stderr(self):
        r = self._run(json.dumps({"tool_input": {"command": "rm -rf /tmp"}}))
        self.assertEqual(r.returncode, 2)
        self.assertIn("BLOCKED", r.stderr)
        self.assertIn("rm -rf", r.stderr)

    def test_powershell_recurse_force_blocked(self):
        r = self._run(json.dumps({"tool_input": {"command": "Remove-Item -Recurse -Force ./dist"}}))
        self.assertEqual(r.returncode, 2)
        self.assertIn("BLOCKED", r.stderr)

    def test_force_push_blocked_but_lease_passes(self):
        bad = self._run(json.dumps({"tool_input": {"command": "git push --force origin main"}}))
        self.assertEqual(bad.returncode, 2)

        ok = self._run(json.dumps({"tool_input": {"command": "git push --force-with-lease origin main"}}))
        self.assertEqual(ok.returncode, 0)


# ---------------------------------------------------------------------------
# stop_check.py — run_check 함수 직접 호출 (tmp_path 시나리오)
# ---------------------------------------------------------------------------

class StopCheckTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_no_package_json_passes_silently(self):
        code = stop_check.run_check(self.root)
        self.assertEqual(code, 0)

    def test_node_modules_missing_passes_with_notice(self):
        (self.root / "package.json").write_text("{}")
        with patch("sys.stderr") as mock_stderr:
            code = stop_check.run_check(self.root)
        self.assertEqual(code, 0)
        # stderr 에 안내 한 줄
        printed = "".join(call.args[0] for call in mock_stderr.write.call_args_list if call.args)
        self.assertIn("node_modules", printed)

    def test_tsc_pass_returns_zero(self):
        (self.root / "package.json").write_text("{}")
        (self.root / "node_modules").mkdir()

        fake = subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")
        with patch("subprocess.run", return_value=fake) as mock_run:
            code = stop_check.run_check(self.root)
        self.assertEqual(code, 0)

        cmd = mock_run.call_args[0][0]
        npx_name = "npx.cmd" if os.name == "nt" else "npx"
        self.assertEqual(cmd[0], npx_name)
        self.assertIn("--no-install", cmd)
        self.assertIn("tsc", cmd)
        self.assertIn("--noEmit", cmd)

    def test_tsc_fail_returns_block(self):
        (self.root / "package.json").write_text("{}")
        (self.root / "node_modules").mkdir()

        fake = subprocess.CompletedProcess(
            args=[], returncode=1,
            stdout="src/foo.ts(3,5): error TS2322", stderr="",
        )
        with patch("subprocess.run", return_value=fake):
            with patch("sys.stderr") as mock_stderr:
                code = stop_check.run_check(self.root)

        self.assertEqual(code, 2)
        printed = "".join(call.args[0] for call in mock_stderr.write.call_args_list if call.args)
        self.assertIn("TypeScript", printed)
        self.assertIn("TS2322", printed)


# ---------------------------------------------------------------------------
# settings.json 정합성
# ---------------------------------------------------------------------------

class SettingsIntegrityTests(unittest.TestCase):
    """.claude/settings.json 이 위 두 스크립트를 올바르게 가리키는지 확인."""

    def test_settings_references_existing_scripts(self):
        repo_root = SCRIPTS_DIR.parent
        settings = json.loads((repo_root / ".claude" / "settings.json").read_text(encoding="utf-8"))

        stop_cmds = [
            h["command"]
            for entry in settings["hooks"]["Stop"]
            for h in entry["hooks"]
        ]
        self.assertTrue(any("stop_check.py" in c for c in stop_cmds),
                        f"Stop hook 이 stop_check.py 를 호출하지 않음: {stop_cmds}")

        pre_entries = settings["hooks"]["PreToolUse"]
        bash_entry = next((e for e in pre_entries if e.get("matcher") == "Bash"), None)
        self.assertIsNotNone(bash_entry, "PreToolUse 의 Bash matcher 가 없음")
        pre_cmds = [h["command"] for h in bash_entry["hooks"]]
        self.assertTrue(any("guard.py" in c for c in pre_cmds),
                        f"PreToolUse(Bash) 가 guard.py 를 호출하지 않음: {pre_cmds}")

    def test_referenced_scripts_exist(self):
        self.assertTrue((SCRIPTS_DIR / "guard.py").exists())
        self.assertTrue((SCRIPTS_DIR / "stop_check.py").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
