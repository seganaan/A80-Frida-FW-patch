import sys

filename = "vendor.samsung.hardware.biometrics.fingerprint@3.0-service"
with open(filename, "rb") as f:
    content = f.read()

# Target string to locate the check context
target = b"Wrong fp version"
idx = content.find(target)
if idx == -1:
    print("[-] Target string not found!")
    sys.exit(1)

print(f"[+] Found target string at offset: {hex(idx)}")

# We look for the surrounding code block and patch the conditional jump or return check.
# Alternatively, patch the expected version check integers directly if found nearby.
