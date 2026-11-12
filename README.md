# A80 Frida FW Patch

> **🚨 CRITICAL WARNING & DISCLAIMER – READ BEFORE PROCEEDING 🚨**
>
> **FOR EXPERIENCED DEVELOPERS AND ADVANCED USERS ONLY:** The tools, scripts, and binary patching concepts in this repository are strictly intended for **tech-savvy individuals** who possess deep familiarity with Android internals, AArch64 assembly, Frida dynamic instrumentation, root/Magisk environments, and low-level firmware recovery.
>
> **RISK OF PERMANENT DEVICE DAMAGE (BRICKING):** Improperly modifying `/vendor` binaries, injecting hooks into critical system/HAL services, or corrupting SELinux contexts can cause **severe bootloops, soft-bricks, hard-bricks, loss of IMEI/baseband, or permanent biometric/Knox hardware failure**.
>
> **NO WARRANTY & ZERO LIABILITY:** Everything in this repository is provided **"AS IS"** without warranty of any kind. The author(s) assume **no responsibility or liability** for bricked devices, corrupted partitions, voided warranties, tripped Samsung Knox flags (`0x1`), or compromised biometric security. **You are solely responsible for your own device. Always make a full NANDroid / partition backup (especially `/vendor`, `/boot`, and `/efs`) before attempting any modifications.**

---

Dynamic instrumentation hooks (Frida) and static binary analysis scripts designed to bypass hardware initialization errors, calibration failures, and firmware version mismatches in the Samsung Galaxy A80 Biometric Fingerprint HAL (`vendor.samsung.hardware.biometrics.fingerprint@3.0-service`).

## 📋 Overview & Reason for the Fix

When porting custom ROMs, replacing screen assemblies, or running modified vendor/system images on the **Samsung Galaxy A80 (SM-A805F)**, the under-display optical fingerprint sensor frequently fails to initialize.

Common root causes include:

* **Calibration Mismatch:** Replacing the display or modifying vendor partitions breaks the factory sensor calibration data, causing `hw_get_module` to return a non-zero error code.
* **Firmware/HAL Version Checks:** The native service `vendor.samsung.hardware.biometrics.fingerprint@3.0-service` performs strict version verification against the underlying TrustZone/vendor library (`Wrong fp version. Expected %d, got %d`). If a mismatch occurs, the service aborts initialization.

This repository provides two approaches to resolving these failures:

1. **Runtime Dynamic Hooking (Frida):** Intercepts native and Java-layer hardware initialization routines in real time and forces success return codes without permanently modifying system binaries.
2. **Static Binary Analysis (Python):** Scans the compiled AArch64 HAL executable to locate version-check strings and offsets for permanent binary patching.

## 📂 Repository Contents

All scripts and target reference binaries are located in the root directory:

### 1. Frida Dynamic Instrumentation Scripts (`.js`)

* **`hook_init.js`**  
  The core lightweight Frida hook. It attaches to `hw_get_module` inside `libhardware.so`. Whenever the `"fingerprint"` hardware module is requested and returns a non-zero failure code, this script intercepts `onLeave` and forces the return value to `0` (Success).
* **`hook_init copy.js`**  
  An extended debugging variant of `hook_init.js`. In addition to forcing `hw_get_module` to return `0`, it enumerates internal symbols inside `vendor.samsung.hardware.biometrics.fingerprint@3.0-service` matching `open`, `init`, or `cal` to assist with deeper symbol tracing.
* **`bypass_init.js`**  
  A dual-layer hook that attaches to both the Android Java framework (`android.hardware.fingerprint.FingerprintManager`) and the native `libhardware.so` layer (`hw_get_module`), ensuring both framework and HAL initialization checks pass.
* **`bypass_fp.js`**  
  A diagnostic and module-discovery script. It enumerates all loaded modules in memory matching `biometrics`, `fingerprint`, or `hw_default`, logs their base memory addresses, and attaches an interceptor to `hw_get_module`.

### 2. Static Binary Analysis Scripts (`.py`)

* **`patch_fp.py`**  
  A Python utility that reads the raw `vendor.samsung.hardware.biometrics.fingerprint@3.0-service` ELF binary and searches for the `"Wrong fp version"` error string offset to identify where conditional version checks occur.
* **`patch_fp copy.py`**  
  An annotated reference version of `patch_fp.py` detailing how AArch64 position-independent executables load `.rodata` string references via `ADRP + ADD` instructions prior to branching.

### 3. Target Reference Binary

* **`vendor.samsung.hardware.biometrics.fingerprint@3.0-service`**  
  The stock 64-bit ARM (`linker64`) Android HIDL biometric service binary from the Samsung Galaxy A80 vendor partition, included as a reference target for offset inspection and testing.

## ⚙️ How It Works

### Native HAL Interception (`hw_get_module`)

During boot or biometric service startup, Android's HAL service calls `hw_get_module("fingerprint", ...)` from `libhardware.so` to load the vendor-specific fingerprint implementation.

```text
[Fingerprint Service] ──► hw_get_module("fingerprint") ──► [Vendor Sensor / Calibration Check]
                                                                    │
                                                     (Fails: returns error != 0)
                                                                    │
[Frida Interceptor] ◄─── Intercepts onLeave() ◄─────────────────────┘
        │
        └──► Replaces return value with 0 (Success) ──► Service continues initialization
```

By overriding the return register (`retval.replace(0)`), the HAL service bypasses the hardware calibration/load error and proceeds to register `ISehBiometricsFingerprint` with the Android HIDL service manager.

## 🚀 How to Implement & Use

### Prerequisites

* **Technical Proficiency:** Comfort with ADB, Linux shell, recovery flashing (Odin/TWRP), and troubleshooting bootloops.
* A rooted **Samsung Galaxy A80** (Magisk or KernelSU) with USB Debugging (`adb`) enabled.
* **Frida Server** (`arm64`) running on the device (`/data/local/tmp/frida-server`).
* **Frida Tools** installed on your PC (`pip install frida-tools`).
* **Full Partition Backups:** Complete backups of `/vendor`, `/boot`, and `/efs` stored safely off-device.

### Step 1: Identify the Fingerprint Service PID

Connect your device via ADB and find the running HAL service process:

```bash
adb shell su -c "ps -A | grep fingerprint"
```

Look for `vendor.samsung.hardware.biometrics.fingerprint@3.0-service`.

### Step 2: Inject the Frida Hook

Run one of the hook scripts directly against the running service (or attach via PID):

**Using the standard initialization bypass:**

```bash
frida -U -n "vendor.samsung.hardware.biometrics.fingerprint@3.0-service" -l hook_init.js
```

**Using the combined Java + Native bypass:**

```bash
frida -U -n "vendor.samsung.hardware.biometrics.fingerprint@3.0-service" -l bypass_init.js
```

**Using module discovery & diagnostics:**

```bash
frida -U -n "vendor.samsung.hardware.biometrics.fingerprint@3.0-service" -l bypass_fp.js
```

*(Note: Because the HAL service starts early during boot, you may need to restart the service after attaching Frida or use a Magisk `post-fs-data` / `service.sh` script with `frida-inject` to hook it automatically on boot).*

### Step 3: Inspecting Offsets for Permanent Binary Patching (Optional)

If you want to locate the string offset inside the included service binary to patch the ARM64 branch instructions permanently (e.g., using Ghidra, IDA Pro, or a hex editor):

```bash
python3 patch_fp.py
```

This will output the exact hexadecimal file offset of `"Wrong fp version"` inside `vendor.samsung.hardware.biometrics.fingerprint@3.0-service`.

## ⚠️ Extended Legal & Safety Disclaimer

1. **Skill Requirement:** Do **not** attempt these procedures if you do not know how to unbrick a Samsung device using Odin, restore stock firmware, or recover from a bootloop via custom recovery.
2. **Biometric Security Impact:** Bypassing hardware calibration checks and version validation compromises the cryptographic and hardware-backed integrity of your device's biometric authentication pipeline. Do not rely on a patched biometric HAL for high-security applications (such as banking or enterprise authentication).
3. **Partition Integrity & dm-verity:** Modifying files directly on `/vendor` without properly disabling `dm-verity` / AVB (Android Verified Boot) or preserving exact file permissions (`chmod 0755`) and SELinux contexts (`u:object_r:hal_fingerprint_default_exec:s0`) will immediately prevent the device from booting.
4. **Indemnification:** By downloading, inspecting, or executing any file in this repository, you agree that you are acting entirely at your own risk.