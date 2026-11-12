Java.perform(function() {
    console.log("[*] Hooking Samsung Biometric Framework...");
    try {
        var FingerprintManager = Java.use("android.hardware.fingerprint.FingerprintManager");
        console.log("[+] Successfully hooked FingerprintManager context.");
    } catch(err) {
        console.log("[-] Error hooking Java layer: " + err.message);
    }
});

Interceptor.attach(Module.findExportByName("libhardware.so", "hw_get_module"), {
    onEnter: function(args) {
        this.module_name = args[0].readUtf8String();
    },
    onLeave: function(retval) {
        if (this.module_name === "fingerprint") {
            console.log("[+] Intercepted hw_get_module for 'fingerprint'. Forcing success return code.");
            retval.replace(0); // Return 0 (Zero = Success)
        }
    }
});
