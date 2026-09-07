from pathlib import Path

from git import Repo
from git.exc import InvalidGitRepositoryError, NoSuchPathError


def get_recent_commits(repo_path: str, limit: int = 10) -> list[dict]:
    path = Path(repo_path).expanduser().resolve()

    try:
        repo = Repo(path, search_parent_directories=True)
    except (InvalidGitRepositoryError, NoSuchPathError) as exc:
        raise ValueError(f"Not a git repository: {path}") from exc

    commits = repo.iter_commits(max_count=limit)

    return [
        {
            "sha": commit.hexsha,
            "short_sha": commit.hexsha[:7],
            "message": commit.summary,
            "author": commit.author.name,
            "email": commit.author.email,
            "committed_at": commit.committed_datetime.isoformat(),
        }
        for commit in commits
    ]
