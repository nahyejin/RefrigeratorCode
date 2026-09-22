package com.cookmatch.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * 홈 화면 "재료 찍기" 위젯(1×1).
 *
 * 왜 위젯이 앱을 열기만 하나:
 *   안드로이드 위젯은 화면을 그리고 누름을 받는 것까지만 할 수 있다(RemoteViews). 카메라를
 *   위젯 안에서 직접 띄울 수는 없다. 그래서 위젯은 `com.cookmatch.app://camera` 로 앱을 열고,
 *   웹 쪽 NativeShortcutBridge 가 그 주소를 받아 내 냉장고의 카메라 시트를 바로 연다.
 *   (그 화면까지 가는 데 홈 → 앱 → 내 냉장고 → 카메라 버튼 네 번이 걸리던 것을 한 번으로 줄인다.)
 *
 * MainActivity 는 `launchMode="singleTask"` 라, 앱이 이미 떠 있으면 새 화면이 쌓이지 않고
 * 기존 화면에 이 인텐트가 전달된다(Capacitor 가 appUrlOpen 으로 넘겨 준다).
 */
public class CameraWidgetProvider extends AppWidgetProvider {

    /** 로그인 복귀와 같은 스킴, host 만 camera (AndroidManifest 의 intent-filter 와 한 쌍) */
    private static final String CAMERA_URI = "com.cookmatch.app://camera";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_camera);

            Intent intent = new Intent(context, MainActivity.class);
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(CAMERA_URI));
            // 위젯에서 열 때는 기존 화면을 그대로 쓰되(singleTask), 백그라운드에 있던 앱이
            // 앞으로 나오도록 한다.
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            // Android 12+ 는 PendingIntent 에 가변/불변을 반드시 밝혀야 한다.
            PendingIntent pending = PendingIntent.getActivity(
                    context, appWidgetId, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            views.setOnClickPendingIntent(R.id.widget_camera_root, pending);
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}
