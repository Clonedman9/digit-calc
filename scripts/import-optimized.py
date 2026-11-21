import hashlib, io, pathlib, shutil, urllib.request, zipfile

data = urllib.request.urlopen("https://1821.ltd/f/file_4nj6iGXx9Kxh", timeout=60).read()
expected = "656bd52eaaf4baef216358268a32ad9da1da057e02c3839949550b8934804ce8"
if hashlib.sha256(data).hexdigest() != expected:
    raise SystemExit("Source archive hash mismatch")
root = pathlib.Path(".verified-source")
root.mkdir(exist_ok=True)
with zipfile.ZipFile(io.BytesIO(data)) as z:
    for entry in z.infolist():
        p = pathlib.PurePosixPath(entry.filename)
        if p.is_absolute() or ".." in p.parts or not p.parts or p.parts[0] != "digit-calc":
            raise SystemExit("Invalid archive path")
        if entry.is_dir() or p.parts[1:2] == ("offline",):
            continue
        out = root.joinpath(*p.parts[1:])
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(z.read(entry))
print("Optimized source verified and extracted")
