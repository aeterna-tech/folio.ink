import subprocess

from app.git.service import get_recent_commits


def test_get_recent_commits(tmp_path):
    repo_path = tmp_path / "repo"
    repo_path.mkdir()

    subprocess.run(
        ["git", "init", str(repo_path)],
        check=True,
        capture_output=True,
    )

    file_path = repo_path / "test.txt"
    file_path.write_text("hello")

    subprocess.run(
        ["git", "-C", str(repo_path), "add", "."],
        check=True,
        capture_output=True,
    )

    subprocess.run(
        [
            "git",
            "-C",
            str(repo_path),
            "-c",
            "user.name=Test User",
            "-c",
            "user.email=test@example.com",
            "commit",
            "-m",
            "Initial commit",
        ],
        check=True,
        capture_output=True,
    )

    commits = get_recent_commits(str(repo_path), limit=10)

    assert len(commits) == 1
    assert commits[0]["message"] == "Initial commit"
    assert commits[0]["author"] == "Test User"
    assert len(commits[0]["sha"]) == 40
    assert commits[0]["short_sha"] == commits[0]["sha"][:7]

import pytest

from app.git.service import get_recent_commits


def test_get_recent_commits_invalid_repository(tmp_path):
    with pytest.raises(ValueError, match="Not a git repository"):
        get_recent_commits(str(tmp_path / "not-a-repo"))
