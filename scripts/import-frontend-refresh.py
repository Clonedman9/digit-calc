import hashlib, io, pathlib, urllib.request, zipfile

data = urllib.request.urlopen("https://1821.ltd/f/file_xWRtP9NRDLRJ", timeout=60).read()
expected = "afe068d71ee28ae65d874c81445a438a7fc1758cac6c3b4a833c6e763aafdcb9"
if hashlib.sha256(data).hexdigest() != expected:
    raise SystemExit("Source archive hash mismatch")
root = pathlib.Path("digit-calc")
root.mkdir(exist_ok=True)
with zipfile.ZipFile(io.BytesIO(data)) as z:
    for entry in z.infolist():
        p = pathlib.PurePosixPath(entry.filename)
        if p.is_absolute() or ".." in p.parts or not p.parts or p.parts[0] != "digit-calc":
            raise SystemExit("Bad archive path")
        if entry.is_dir():
            continue
        out = root.joinpath(*p.parts[1:])
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(z.read(entry))
print("Frontend source verified and extracted")
