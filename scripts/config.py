from html import escape
from pathlib import Path


USERNAME = "dumbly-smart"
TIMEZONE = "Asia/Kolkata"
KURALS_PATH = Path(__file__).resolve().parent.parent / "data" / "kurals.json"
CONTRIBUTIONS_PATH = Path(__file__).resolve().parent.parent / "data" / "contributions.json"
GENERATED_DIR = Path(__file__).resolve().parent.parent / "generated"
AVATAR_URL = f"https://github.com/{USERNAME}.png?size=512"


def xml_escape(value):
    return escape(str(value), quote=True)
