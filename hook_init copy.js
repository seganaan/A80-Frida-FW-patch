setTimeout(function() {
    console.log("[*] Hooking Samsung Fingerprint 3.0 Service...");

    // Find hw_get_module or dynamic library open routines
    let open_methods = Module.findExportByName("libhardware.so", "hw_get_module");
    if (open_methods) {
        Interceptor.attach(open_methods, {
            onEnter: function(args) {
                this.id = args[0].readUtf8String();
                console.log("[*] hw_get_module ID requested: " + this.id);
            },
            onLeave: function(retval) {
                console.log("[*] hw_get_module returned: " + retval);
                // If it's the fingerprint module failing to load/initialize due to calibration
                if (this.id === "fingerprint" && retval.toInt32() !== 0) {
                    console.log("[!] Bypassing hardware module failure, forcing return to 0 (Success)");
                    retval.replace(0);
                }
            }
        });
    }

    // Also hook any internal status checks returning negative or error codes
    let syms = Process.enumerateSymbolsSync("vendor.samsung.hardware.biometrics.fingerprint@3.0-service");
    syms.forEach(function(sym) {
        if (sym.name.indexOf("open") !== -1 || sym.name.indexOf("init") !== -1 || sym.name.indexOf("cal") !== -1) {
            // console.log("[*] Symbol found: " + sym.name + " at " + sym.address);
        }
    });

}, 500);
