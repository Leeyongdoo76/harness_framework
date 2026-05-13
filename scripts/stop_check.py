#!/usr/bin/env python3
"""
Stop hook 검증 — 응답 종료 시 타입 검사만 빠르게 실행한다.

설계 원칙:
- 프로젝트 부트스트랩(package.json 생성) 이전이면 조용히 통과한다.
- node_modules 가 아직 없으면 안내만 stderr 로 출력하고 통과한다.
- 이후엔 `npx --no-install tsc --noEmit` 만 실행한다. 풀 빌드/테스트는 step AC 가 책임진다.
- tsc 실패 시 exit 2 — Claude Code 가 stderr 를 다음 턴으로 피드백한다.

이 hook 의 목적은 "타입 에러를 즉시 발견하여 다음 응답에 고치게 만드는 것"이지,
"매 응답마다 풀세트 회귀 테스트를 도는 것"이 아니다.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

EXIT_OK = 0
EXIT_BLOCK = 2  # Claude Code: Claude 가 stderr 를 받아 후속 작업으로 처리


def _force_utf8_stderr() -> None:
    """Windows 등에서 sys.stderr 기본 인코딩이 cp949 면 한글 메시지가 깨진다.
    Claude Code 가 hook stderr 를 UTF-8 로 읽으므로 출력 인코딩을 고정한다."""
    try:
        sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except (AttributeError, OSError):
        pass


def run_check(root: Path) -> int:
    """주어진 프로젝트 루트에 대해 검사하고 exit code 를 반환한다.

    stderr 출력은 함수가 직접 print 한다 (Claude Code hooks 명세상 stderr 가
    Claude 에게 피드백되므로 굳이 반환값으로 빼지 않는다).
    """
    pkg_json = root / "package.json"
    if not pkg_json.exists():
        return EXIT_OK

    node_modules = root / "node_modules"
    if not node_modules.exists():
        print(
            "stop_check: node_modules 가 없습니다. `npm install` 이후 다시 확인하세요.",
            file=sys.stderr,
        )
        return EXIT_OK

    npx = "npx.cmd" if os.name == "nt" else "npx"
    result = subprocess.run(
        [npx, "--no-install", "tsc", "--noEmit"],
        cwd=root,
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        return EXIT_OK

    print("stop_check: TypeScript 타입 검사 실패", file=sys.stderr)
    if result.stdout:
        print(result.stdout, file=sys.stderr)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return EXIT_BLOCK


def main() -> int:
    _force_utf8_stderr()
    root = Path(__file__).resolve().parent.parent
    return run_check(root)


if __name__ == "__main__":
    sys.exit(main())
