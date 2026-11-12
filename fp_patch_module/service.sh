#!/system/bin/sh
MODDIR=${0%/*}
nohup $MODDIR/frida-server >/dev/null 2>&1 &
