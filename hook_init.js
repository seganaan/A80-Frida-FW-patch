setTimeout(function() {
    console.log("[*] Hooking Samsung Fingerprint 3.0 Service...");
    let open_methods = Module.findExportByName("libhardware.so", "hw_get_module");
    if (open_methods) {
        Interceptor.attach(open_methods, {
            onEnter: function(args) {
                this.id = args[0].readUtf8String();
                console.log("[*] hw_get_module ID requested: " + this.id);
            },
            onLeave: function(retval) {
                console.log("[*] hw_get_module returned: " + retval);
                if (this.id === "fingerprint" && retval.toInt32() !== 0) {
                    console.log("[!] Bypassing hardware module failure, forcing return to 0 (Success)");
                    retval.replace(0);
                }
            }
        });
    }
}, 500);
