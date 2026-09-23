package com.cookmatch.app;

import android.content.Context;
import android.widget.RemoteViews;

/**
 * 홈 화면 위젯 1×1 — 「재료 찍기」 하나(2026-09-23 요청). 누르면 앱이 열리며 사진으로 재료 담기 시트가 바로 뜬다.
 * 모양은 다른 버튼 위젯과 같은 흰 카드 + 둥근 네모 타일이고, 카드는 정사각형으로 맞춘다.
 */
public class CameraWidgetProvider extends QuickWidgetProvider {

    @Override
    protected int layoutId() {
        return R.layout.widget_camera;
    }

    @Override
    protected boolean keepSquare() {
        return true;
    }

    @Override
    protected void bindButtons(Context context, RemoteViews views, int appWidgetId) {
        views.setOnClickPendingIntent(R.id.widget_camera_button, openApp(context, appWidgetId * 3, CAMERA_URI));
    }
}
