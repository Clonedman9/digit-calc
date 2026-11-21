import hashlib, io, pathlib, subprocess, urllib.request, zipfile

data = urllib.request.urlopen("https://1821.ltd/f/file_SlvK9RGAYWIO", timeout=60).read()
if hashlib.sha256(data).hexdigest() != "b95a4afcf6e2918d5f5c05d9b10a3b1f67c67a9767445f998f9232def0850338":
    raise SystemExit("Source checksum mismatch")
allowed = {"assets/core.js", "assets/app.js", "README.md", "tests/review-followup.test.cjs"}
with zipfile.ZipFile(io.BytesIO(data)) as z:
    for name in allowed:
        out = pathlib.Path(name)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(z.read("digit-calc/" + name))
subprocess.run(["node", "--test", *map(str, pathlib.Path("tests").glob("*.test.cjs"))], check=True)
subprocess.run(["node", "scripts/build-standalone.cjs"], check=True)
