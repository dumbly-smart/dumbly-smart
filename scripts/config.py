from html import escape
from pathlib import Path


USERNAME = "dumbly-smart"
TIMEZONE = "Asia/Kolkata"
KURALS_PATH = Path(__file__).resolve().parent.parent / "data" / "kurals.json"


def xml_escape(value):
    return escape(str(value), quote=True)
