package com.clubcarder.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;

final class NativeConnectivity {
    static boolean isOnline(Context context) {
        ConnectivityManager manager = context.getSystemService(ConnectivityManager.class);
        if (manager == null) return false;
        NetworkCapabilities network = manager.getNetworkCapabilities(manager.getActiveNetwork());
        return network != null
            && network.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && network.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }
}
