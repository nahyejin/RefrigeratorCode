package com.cookmatch.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

/**
 * 홈 화면 위젯 3×1 — 「재료 찍기」·「요리 AI」·「AI 식단」 세 버튼(둥근 네모 타일).
 * 정사각형 2×2([QuickWidgetSquareProvider])·재료 찍기 1×1([CameraWidgetProvider])이 이 클래스를 상속해
 * 레이아웃과 버튼 수만 바꾼다.
 *
 * 왜 앱을 여는 방식인가:
 *   안드로이드 위젯은 화면을 그리고 누름을 받는 것까지만 할 수 있다(RemoteViews). 위젯 안에서 카메라를
 *   띄우거나 사진을 처리할 수 없고, 무엇을 찍는지(영수증/음식) 고르는 것도 앱 화면이 필요하다.
 *   그래서 버튼마다 주소를 하나씩 열고(`…://camera`, `…://chat`, `…://plan`), 웹 쪽 NativeShortcutBridge 가
 *   받아서 카메라 시트를 열거나, 요리 AI 대화창을 띄우거나, 일주일 식단 화면으로 보낸다.
 *
 * 정사각형 유지([keepSquare]): 런처마다 한 칸의 가로세로 비율이 달라 「2×2」·「1×1」이 세로로 길쭉해 보였다
 * (2026-09-23 사용자 지적 — "말만 2×2지 정사각형이 아니다"). 위젯이 받은 실제 크기를 보고 긴 쪽에 투명 여백을
 * 줘서 흰 카드를 눈으로 봐도 정사각형이 되게 한다. 레이아웃 바깥이 투명 FrameLayout(`square_root`)이어야 한다.
 */
public class QuickWidgetProvider extends AppWidgetProvider {

    /** 로그인 복귀(…://auth)와 같은 스킴, host 로 갈린다 — AndroidManifest 의 intent-filter 와 한 쌍 */
    protected static final String CAMERA_URI = "com.cookmatch.app://camera";
    protected static final String CHAT_URI = "com.cookmatch.app://chat";
    protected static final String PLAN_URI = "com.cookmatch.app://plan";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) render(context, manager, id);
    }

    /** 크기가 바뀌면(배치·리사이즈) 정사각형 여백을 다시 잰다. */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, manager, id);
    }

    private void render(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId());
        bindButtons(context, views, appWidgetId);
        if (keepSquare()) squareUp(context, views, manager.getAppWidgetOptions(appWidgetId));
        manager.updateAppWidget(appWidgetId, views);
    }

    /** 가로형(3×1)은 이 레이아웃, 나머지는 하위 클래스가 덮어쓴다. */
    protected int layoutId() {
        return R.layout.widget_quick;
    }

    /** 카드를 정사각형으로 맞출지 — 2×2·1×1 이 켠다. */
    protected boolean keepSquare() {
        return false;
    }

    /** 버튼 세 개를 연결한다. 버튼 수가 다른 위젯은 덮어쓴다(레이아웃에 없는 id 에 걸면 위젯이 안 뜬다). */
    protected void bindButtons(Context context, RemoteViews views, int appWidgetId) {
        views.setOnClickPendingIntent(R.id.widget_camera_button, openApp(context, appWidgetId * 3, CAMERA_URI));
        views.setOnClickPendingIntent(R.id.widget_chat_button, openApp(context, appWidgetId * 3 + 1, CHAT_URI));
        views.setOnClickPendingIntent(R.id.widget_plan_button, openApp(context, appWidgetId * 3 + 2, PLAN_URI));
    }

    /**
     * 받은 칸이 직사각형이면 긴 쪽 양끝에 투명 여백을 줘 카드를 정사각형으로.
     * 세로 화면 기준 크기는 가로 = MIN_WIDTH, 세로 = MAX_HEIGHT 이다(런처 규약).
     */
    private void squareUp(Context context, RemoteViews views, Bundle opts) {
        if (opts == null) return;
        int w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (w <= 0 || h <= 0) return;
        float density = context.getResources().getDisplayMetrics().density;
        int extra = Math.round(Math.abs(h - w) * density / 2f);
        if (h > w) views.setViewPadding(R.id.square_root, 0, extra, 0, extra);
        else views.setViewPadding(R.id.square_root, extra, 0, extra, 0);
    }

    /**
     * 버튼 하나가 여는 인텐트. requestCode 가 같으면 안드로이드가 **같은 PendingIntent 로 보고**
     * 먼저 만든 것을 재사용해 두 버튼이 같은 곳으로 가 버린다 — 위젯마다 세 개씩 다른 번호를 준다.
     */
    protected PendingIntent openApp(Context context, int requestCode, String uri) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(uri));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        // Android 12+ 는 가변/불변을 반드시 밝혀야 한다.
        return PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
