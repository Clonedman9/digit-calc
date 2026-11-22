import hashlib, io, pathlib, subprocess, urllib.request, zipfile

data = urllib.request.urlopen("https://1821.ltd/f/file_1ic7pYRkGaTi", timeout=60).read()
if hashlib.sha256(data).hexdigest() != "cb62fdcefc1a89db151d32cb64df4cab0c3b6be355548331cce95bc0575f8bea":
    raise SystemExit("Patch checksum mismatch")
files = ["assets/app.css", "README.md", "tests/input.test.cjs", "tests/tablet-layout.test.cjs", "scripts/check-tablet-layout.py"]
with zipfile.ZipFile(io.BytesIO(data)) as z:
    for name in files:
        p = pathlib.Path(name)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(z.read(name))
subprocess.run(["node", "--test", *map(str, pathlib.Path("tests").glob("*.test.cjs"))], check=True)
subprocess.run(["node", "scripts/build-standalone.cjs"], check=True)
