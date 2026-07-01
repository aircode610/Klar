"""Regression test for issue #18 / CVE-2026-45829.

ChromaDB >= 1.0.0 ships a pre-authentication code-injection vulnerability
(CVE-2026-45829). The fix pins ``chromadb<1.0.0`` in every requirements file
so a vulnerable 1.x release can never be resolved. These tests fail loudly if
anyone later loosens that upper bound (e.g. drops the ``<1.0.0`` marker), which
would silently reintroduce the vulnerable range.

The check is intentionally version-install-agnostic: it parses the declared
dependency specifier rather than the currently-installed package, so it holds
even in environments that still have an old vulnerable build cached.
"""

from pathlib import Path

import pytest
from packaging.requirements import Requirement

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Requirements files that declare the chromadb dependency.
_REQ_FILES = [
    _REPO_ROOT / "backend" / "requirements.txt",
    _REPO_ROOT / "ai" / "requirements.txt",
]

# Versions inside the CVE-affected range (>= 1.0.0) that MUST be excluded.
# 1.5.9 is the exact version the issue reported as installed.
_VULNERABLE_VERSIONS = ["1.0.0", "1.0.1", "1.5.9", "1.9.0"]

# A known-good pre-1.0 version the project supports, which MUST stay allowed.
_SAFE_VERSION = "0.6.3"


def _chromadb_requirement(req_file: Path) -> Requirement:
    assert req_file.exists(), f"missing requirements file: {req_file}"
    for raw in req_file.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        # Strip inline comments so Requirement() parses cleanly.
        line = line.split("#", 1)[0].strip()
        if line.lower().startswith("chromadb"):
            return Requirement(line)
    raise AssertionError(f"no chromadb requirement found in {req_file}")


@pytest.mark.parametrize(
    "req_file", _REQ_FILES, ids=lambda p: str(p.name and p.parent.name + "/" + p.name)
)
def test_chromadb_declared_in_requirements(req_file):
    """Each requirements file still declares chromadb (guards the parse below)."""
    req = _chromadb_requirement(req_file)
    assert req.name == "chromadb"
    # An explicit upper bound must be present — an unbounded spec is vulnerable.
    assert str(req.specifier), f"chromadb has no version specifier in {req_file}"


@pytest.mark.parametrize(
    "req_file", _REQ_FILES, ids=lambda p: p.parent.name + "/" + p.name
)
@pytest.mark.parametrize("version", _VULNERABLE_VERSIONS)
def test_vulnerable_chromadb_versions_excluded(req_file, version):
    """CVE-2026-45829 range (chromadb >= 1.0.0) is not resolvable."""
    spec = _chromadb_requirement(req_file).specifier
    assert version not in spec, (
        f"{req_file} allows vulnerable chromadb=={version} "
        f"(CVE-2026-45829); specifier is {spec!r}"
    )


@pytest.mark.parametrize(
    "req_file", _REQ_FILES, ids=lambda p: p.parent.name + "/" + p.name
)
def test_safe_chromadb_version_still_allowed(req_file):
    """The pin excludes only the 1.x range, not the supported 0.x line."""
    spec = _chromadb_requirement(req_file).specifier
    assert _SAFE_VERSION in spec, (
        f"{req_file} unexpectedly rejects supported chromadb=={_SAFE_VERSION}; "
        f"specifier is {spec!r}"
    )
