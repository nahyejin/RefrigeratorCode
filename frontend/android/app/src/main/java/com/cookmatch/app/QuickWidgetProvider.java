package com.cookmatch.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * 홈 화면 위젯 2×1 — 「재료 찍기」와 「AI 챗봇」 두 버튼.
 *
 * 왜 앱을 여는 방식인가:
 *   안드로이드 위젯은 화면을 그리고 누름을 받는 것까지만 할 수 있다(RemoteViews). 위젯 안에서 카메라를
 *   띄우거나 사진을 처리할 수 없고, 무엇을 찍는지(영수증/음식) 고르는 것도 앱 화면이 필요하다.
 *   그래서 버튼마다 주소를 하나씩 열고(`…://camera`, `…://chat`), 웹 쪽 NativeShortcutBridge 가
 *   받아서 카메라 시트를 열거나 챗봇 대화창을 띄운다.
 *
 * 왜 두 개인가(2026-09-23):
 *   1×1 카메라 위젯만 있었는데, 홈 화면에서 노란 바탕이 너무 튀고 자리도 아깝다는 지적이 있었다.
 *   흰 카드 하나에 자주 쓰는 입구 둘을 담고, 색은 아이콘 원만 옅은 회색으로 둔다(색은 values/colors.xml).
 *   요리 캘린더는 위젯에서 뺐다 — 서버에서 기록을 따로 가져와야 해서 작업이 훨씬 크고, 홈 화면에서
 *   훑어보는 값어치는 이 둘보다 낮다.
 */
public class QuickWidgetProvider extends AppWidgetProvider {

    /** 로그인 복귀(…://auth)와 같은 스킴, host 로 갈린다 — AndroidManifest 의 intent-filter 와 한 쌍 */
    private static final String CAMERA_URI = "com.cookmatch.app://camera";
    private static final String CHAT_URI = "com.cookmatch.app://chat";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick);
            views.setOnClickPendingIntent(R.id.widget_camera_button,
                    openApp(context, appWidgetId * 2, CAMERA_URI));
            views.setOnClickPendingIntent(R.id.widget_chat_button,
                    openApp(context, appWidgetId * 2 + 1, CHAT_URI));
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    /**
     * 버튼 하나가 여는 인텐트. requestCode 가 같으면 안드로이드가 **같은 PendingIntent 로 보고**
     * 먼저 만든 것을 재사용해 두 버튼이 같은 곳으로 가 버린다 — 위젯마다 두 개씩 다른 번호를 준다.
     */
    private PendingIntent openApp(Context context, int requestCode, String uri) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(uri));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        // Android 12+ 는 가변/불변을 반드시 밝혀야 한다.
        return PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
