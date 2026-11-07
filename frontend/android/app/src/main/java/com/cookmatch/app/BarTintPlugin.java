package com.cookmatch.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.view.Window;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 웹 스플래시(SplashScreen.tsx) 동안 상태바(위)·내비게이션 바(아래) 영역까지 노랑 #FFD600 으로 맞추는 작은 플러그인.
 * 웹에서 `registerPlugin('BarTint').setSplash({ active })` 로 부른다(utils/barTint.ts). 2026-11-08 「맨 위가 하얀색」.
 *
 * 안드로이드 15+ (targetSdk 36) 는 앱이 시스템 바 뒤까지 그려지고 웹뷰만 바 두께만큼 안쪽으로 들어가 있어서,
 * 바 영역에 보이는 것은 창 배경이다 — 그 배경을 노랑으로 바꿨다가 끝나면 원래 배경으로 되돌린다.
 * 안드로이드 14 이하는 바 자체의 색(statusBarColor·navigationBarColor)을 바꾼다(15+ 에서는 무시되는 값).
 */
@CapacitorPlugin(name = "BarTint")
public class BarTintPlugin extends Plugin {

    private static final int SPLASH_YELLOW = Color.parseColor("#FFD600");

    private boolean applied = false;
    private Drawable savedBackground;
    private int savedStatusBarColor;
    private int savedNavigationBarColor;

    @PluginMethod
    public void setSplash(final PluginCall call) {
        final boolean active = Boolean.TRUE.equals(call.getBoolean("active", false));
        final Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                apply(activity.getWindow(), active);
            } catch (Exception ignored) {
                // 색 맞추기는 장식이다 — 실패해도 앱은 그대로 쓴다
            }
            call.resolve();
        });
    }

    @SuppressWarnings("deprecation")
    private void apply(Window window, boolean active) {
        if (active == applied) return;
        if (active) {
            savedBackground = window.getDecorView().getBackground();
            savedStatusBarColor = window.getStatusBarColor();
            savedNavigationBarColor = window.getNavigationBarColor();
            window.setBackgroundDrawable(new ColorDrawable(SPLASH_YELLOW));
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                window.setStatusBarColor(SPLASH_YELLOW);
                window.setNavigationBarColor(SPLASH_YELLOW);
            }
        } else {
            window.setBackgroundDrawable(savedBackground != null ? savedBackground : new ColorDrawable(Color.WHITE));
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                window.setStatusBarColor(savedStatusBarColor);
                window.setNavigationBarColor(savedNavigationBarColor);
            }
        }
        applied = active;
    }
}
