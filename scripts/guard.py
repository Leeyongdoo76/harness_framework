#!/usr/bin/env python3
"""
PreToolUse 가드 — 위험 명령을 차단한다.

Claude Code hooks 명세대로 stdin에서 JSON을 읽고,
tool_input.command 가 위험 패턴이면 exit 2 + stderr 메시지로 차단한다.

설치: .claude/settings.json 의 PreToolUse(Bash) hook 에서 호출.

    python scripts/guard.py
"""

from __future__ import annotations

import json
import re
import sys

EXIT_BLOCK = 2  # Claude Code: stderr 를 Claude 에게 피드백하며 도구 호출 차단
EXIT_ALLOW = 0


def _force_utf8_stderr() -> None:
    """Windows 등에서 sys.stderr 기본 인코딩이 cp949 면 한글 메시지가 깨진다.
    Claude Code 가 hook stderr 를 UTF-8 로 읽으므로 출력 인코딩을 고정한다."""
    try:
        sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except (AttributeError, OSError):
        pass

# (정규식, 사람이 읽을 사유) 튜플 목록.
# - 다양한 공백 / 플래그 순서를 허용하되, false positive 를 줄이도록 단어 경계를 둔다.
# - 패턴은 대소문자 무시(re.IGNORECASE) 로 매칭한다.
DANGEROUS_PATTERNS: list[tuple[str, str]] = [
    # rm 의 재귀+강제 조합: 단축형 (-rf / -fr / -Rf 등) + long form (--recursive + --force).
    (
        r"\brm\b[^|;]*(?:"
        r"-[a-z]*r[a-z]*f"
        r"|-[a-z]*f[a-z]*r"
        r"|--recursive\b[^|;]*--force\b"
        r"|--force\b[^|;]*--recursive\b"
        r")",
        "rm 재귀 강제 삭제",
    ),
    # PowerShell 의 재귀+강제 삭제: Remove-Item 본명 + alias (ri/rmdir/rd/del).
    # 플래그도 -Recurse/-r, -Force/-f 모두 허용. 순서는 양방향.
    (
        r"\b(?:Remove-Item|rmdir|ri|rd|del)\b[^|;]*\s-(?:Recurse|r)\b[^|;]*\s-(?:Force|f)\b",
        "PowerShell 재귀 강제 삭제 (Remove-Item 류)",
    ),
    (
        r"\b(?:Remove-Item|rmdir|ri|rd|del)\b[^|;]*\s-(?:Force|f)\b[^|;]*\s-(?:Recurse|r)\b",
        "PowerShell 재귀 강제 삭제 (Remove-Item 류, 플래그 역순)",
    ),
    (r"\bgit\s+push\b[^|;]*\s--force\b(?!-with-lease)", "git push --force (force-with-lease 가 아닌)"),
    (r"\bgit\s+push\b[^|;]*\s-f\b", "git push -f"),
    (r"\bgit\s+reset\b[^|;]*\s--hard\b", "git reset --hard"),
    (r"\bgit\s+clean\b[^|;]*\s-[a-z]*f", "git clean -f 류"),
    (r"\bgit\s+branch\b[^|;]*\s-D\b", "git branch -D (강제 삭제)"),
    (r"\bgit\s+checkout\b[^|;]*\s--\s+\.", "git checkout -- . (전체 작업 디렉토리 폐기)"),
    # git restore . / git restore --staged . — checkout 의 현대적 후속자.
    (r"\bgit\s+restore\b[^|;]*\s+\.\B(?!\S)", "git restore . 류 작업 디렉토리 폐기"),
    (r"\bDROP\s+(TABLE|DATABASE|SCHEMA)\b", "SQL DROP 문"),
    (r"\bTRUNCATE\s+TABLE\b", "SQL TRUNCATE 문"),
    (r"\bmkfs\.[a-z0-9]+\b", "파일시스템 포맷 (mkfs)"),
    # dd if = (공백 포함 변형) 도 매치.
    (r"\bdd\s+if\s*=", "dd 디스크 덤프"),
    # 뒤의 [A-Z]: 끝에 \b 를 두면 ':' 와 문자열 끝 사이엔 word boundary 가 안 생긴다.
    # 명시적으로 ':' 다음에 경로 구분자/공백/문자열 끝이 와야 매치되게 잡는다.
    (r"\b(format|Format-Volume)\s+[A-Z]:(?:[\\/\s]|$)", "Windows 볼륨 포맷"),
]


def find_violation(command: str) -> str | None:
    """위험 패턴이 매칭되면 사유 문자열을, 없으면 None 을 돌려준다."""
    for pattern, reason in DANGEROUS_PATTERNS:
        if re.search(pattern, command, flags=re.IGNORECASE):
            return reason
    return None


def main() -> int:
    _force_utf8_stderr()
    raw = sys.stdin.read()
    if not raw.strip():
        return EXIT_ALLOW

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        # 입력 포맷이 바뀌었거나 비어 있으면 차단하지 않는다.
        return EXIT_ALLOW

    tool_input = payload.get("tool_input") or {}
    command = tool_input.get("command") or ""
    if not command:
        return EXIT_ALLOW

    reason = find_violation(command)
    if reason is None:
        return EXIT_ALLOW

    print(
        f"BLOCKED: 위험한 명령이 감지되었습니다 — {reason}\n"
        f"명령: {command}\n"
        f"의도된 작업이라면 사용자가 직접 실행하도록 안내하세요.",
        file=sys.stderr,
    )
    return EXIT_BLOCK


if __name__ == "__main__":
    sys.exit(main())
