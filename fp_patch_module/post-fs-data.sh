#!/system/bin/sh
MODPATH=${0%/*}
chcon -R u:object_r:vendor_file:s0 $MODPATH/system/vendor/bin/hw/
