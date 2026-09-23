package com.cookmatch.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * 홈 화면 **마이캘린더 위젯** — 보기 전용. 두 크기를 같은 코드로 그린다.
 * 레이아웃은 scripts/gen_widget_calendar_layouts.py 가 만든다(id 가 이 파일과 한 쌍).
 *
 *   4×2([CalendarWidgetProvider])       「2026년 9월」 / 왼쪽 달력 + 오른쪽 목표·오늘 한 줄·범례
 *   4×3([CalendarBigWidgetProvider])    「2026년 9월」 / 목표·범례 / 달력 + 「오늘」·「내일」 목록(늘리면 4×4)
 *
 * 앱 마이캘린더 화면과 **같은 표식**을 쓴다:
 *   · 완료한 날 — 그 요리를 한 사람의 색 점(여러 명이면 점이 여러 개, 3개까지만)
 *   · 계획한 날 — 빨간 펜으로 동그라미 친 표식(앱의 HandCircle 과 같은 획)
 *   · 오늘 — 옅은 회색 칠
 *   · 목록 — 범례와 같은 꽉 찬 사람 색 점, 이미 한 요리는 끝에 「완료」
 * 조작(삭제·목표 수정)은 없다. 누르면 앱의 마이캘린더로 간다.
 *
 * 데이터: 앱이 마이캘린더를 열 때 남긴 요약본(웹 `utils/widgetSnapshot.ts` → SharedPreferences
 * `CapacitorStorage` 의 `cookmatch_calendar`). 위젯은 앱과 다른 프로세스라 로그인 토큰을 쓸 수 없어
 * 서버를 직접 부르지 않는다 — 그래서 **앱을 마지막으로 연 시점 기준**이다. 앱이 화면에서 빠질 때
 * (MainActivity.onPause) [refreshAll] 로 다시 그리고, 로그아웃하면 요약본이 지워져 빈 달력이 된다.
 */
public class CalendarWidgetProvider extends AppWidgetProvider {

    /** Capacitor Preferences 가 쓰는 SharedPreferences 이름과 키(웹 utils/widgetSnapshot.ts 와 한 쌍) */
    private static final String CAP_PREFS = "CapacitorStorage";
    private static final String SNAPSHOT_KEY = "cookmatch_calendar";

    private static final String CALENDAR_URI = "com.cookmatch.app://calendar";

    /** 4×2 의 날짜 칸·점·계획 동그라미 id */
    private static final int[] CELL_IDS = new int[42];
    private static final int[][] DOT_IDS = new int[42][3];
    private static final int[] PLAN_IDS = new int[42];
    /** 4×3 쪽 같은 것들 */
    private static final int[] BIG_CELL_IDS = new int[42];
    private static final int[][] BIG_DOT_IDS = new int[42][3];
    private static final int[] BIG_PLAN_IDS = new int[42];

    private static final int[] TODAY_ROW_IDS = { R.id.today_row_0, R.id.today_row_1, R.id.today_row_2 };
    private static final int[] TODAY_DOT_IDS = { R.id.today_dot_0, R.id.today_dot_1, R.id.today_dot_2 };
    private static final int[] TODAY_TEXT_IDS = { R.id.today_text_0, R.id.today_text_1, R.id.today_text_2 };
    private static final int[] TODAY_DONE_IDS = { R.id.today_done_0, R.id.today_done_1, R.id.today_done_2 };
    private static final int[] TMR_ROW_IDS = { R.id.tmr_row_0, R.id.tmr_row_1, R.id.tmr_row_2 };
    private static final int[] TMR_DOT_IDS = { R.id.tmr_dot_0, R.id.tmr_dot_1, R.id.tmr_dot_2 };
    private static final int[] TMR_TEXT_IDS = { R.id.tmr_text_0, R.id.tmr_text_1, R.id.tmr_text_2 };
    private static final int[] TMR_DONE_IDS = { R.id.tmr_done_0, R.id.tmr_done_1, R.id.tmr_done_2 };

    /** 4×3 하위 클래스가 덮어쓴다. */
    protected boolean isBig() {
        return false;
    }

    protected int layoutId() {
        return R.layout.widget_calendar;
    }

    /** 두 크기 모두 다시 그린다 — 앱이 화면에서 빠질 때(요약본을 새로 썼거나 지웠을 수 있다) 부른다. */
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> cls : new Class<?>[] { CalendarWidgetProvider.class, CalendarBigWidgetProvider.class }) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, cls));
            if (ids.length == 0) continue;
            Intent update = new Intent(context, cls);
            update.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            update.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            context.sendBroadcast(update);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    /** 크기를 바꾸면 게이지·범례 비트맵을 새 폭에 맞춰 다시 그린다. */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, manager, id);
    }

    private void render(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId());

        JSONObject days = null, snap = null;
        try {
            String raw = context.getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE).getString(SNAPSHOT_KEY, null);
            if (raw != null) {
                snap = new JSONObject(raw);
                days = snap.optJSONObject("days");
            }
        } catch (Exception ignored) {
            // 요약본이 없거나 깨졌으면 빈 달력을 그린다 — 앱을 한 번 열면 채워진다.
        }

        Calendar today = Calendar.getInstance();
        int year = today.get(Calendar.YEAR);
        int month = today.get(Calendar.MONTH) + 1;
        // 지난달 요약본이면 달력 점·목록이 이번 달과 안 맞는다 — 그리지 않는다.
        if (snap != null && !String.format(Locale.KOREA, "%d-%02d", year, month).equals(snap.optString("month"))) {
            snap = null;
            days = null;
        }
        int done = snap == null ? 0 : snap.optInt("done", 0);
        Integer goal = (snap == null || snap.isNull("goal")) ? null : snap.optInt("goal");
        String p = isBig() ? "big" : "small";

        // 폭(dp) — 위젯 옵션의 세로 화면 최소 폭. 모르면 4칸 기본값.
        Bundle opts = manager.getAppWidgetOptions(widgetId);
        int widthDp = opts == null ? 0 : opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        if (widthDp <= 0) widthDp = 320;
        // 게이지·범례가 들어갈 폭: 4×3 은 카드 안쪽 전체, 4×2 는 오른쪽 칸
        int innerDp = widthDp - 28;
        int columnDp = isBig() ? innerDp : (innerDp - 14) / 2;
        int columnPx = dp(context, columnDp);

        // 제목은 맨 위 한 번만(2026-09-23 — 「2026년 9월 목표」·「2026년 9월」 중복이 읽기 부담스럽다는 지적)
        views.setTextViewText(R.id.month_title, String.format(Locale.KOREA, "%d년 %d월", year, month));

        drawGrid(context, views, today, days);

        int pct = (goal == null || goal <= 0) ? 0 : Math.min(100, Math.round(done * 100f / goal));
        // 4×2 오른쪽 칸은 좁아서 「달성」 없이 숫자만
        String progress = goal == null ? String.format(Locale.KOREA, "%d회 완료", done)
                : isBig() ? String.format(Locale.KOREA, "%d회 / %d회 달성 (%d%%)", done, goal, pct)
                : String.format(Locale.KOREA, "%d / %d회 (%d%%)", done, goal, pct);
        views.setTextViewText(res(p, "progress_text"), progress);
        views.setImageViewBitmap(res(p, "gauge"), gaugeBitmap(context, snap, goal, columnPx));
        long savings = (snap == null || snap.isNull("goalSavings")) ? 0 : snap.optLong("goalSavings", 0);
        String savingsText;
        if (snap == null) savingsText = "마이캘린더를 열면 기록이 보여요";
        else if (goal != null && savings > 0)
            savingsText = String.format(Locale.KOREA, "목표를 다 채우면 약 %,d원", savings);
        else savingsText = "앱에서 목표를 정하면 절약액을 계산해요";
        views.setTextViewText(res(p, "savings"), savingsText);

        views.setImageViewBitmap(res(p, "legend"), legendBitmap(context, snap, columnPx));

        if (isBig()) {
            drawDayList(views, snap, "today", TODAY_ROW_IDS, TODAY_DOT_IDS, TODAY_TEXT_IDS, TODAY_DONE_IDS, R.id.today_empty);
            drawDayList(views, snap, "tomorrow", TMR_ROW_IDS, TMR_DOT_IDS, TMR_TEXT_IDS, TMR_DONE_IDS, R.id.tmr_empty);
        } else {
            // 4×2 는 오늘 한 줄 — 더 있으면 「외 N개」
            int n = drawDayList(views, snap, "today",
                    new int[] { R.id.small_today_row_0 }, new int[] { R.id.small_today_dot_0 },
                    new int[] { R.id.small_today_text_0 }, new int[] { R.id.small_today_done_0 }, R.id.small_today_empty);
            views.setViewVisibility(R.id.small_today_more, n > 1 ? View.VISIBLE : View.GONE);
            views.setTextViewText(R.id.small_today_more, String.format(Locale.KOREA, "외 %d개", n - 1));
        }

        // 위젯 전체를 누르면 앱의 마이캘린더로 — 위젯에서 할 수 있는 유일한 동작이다.
        Intent open = new Intent(context, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse(CALENDAR_URI));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(isBig() ? R.id.big_root : R.id.small_root,
                PendingIntent.getActivity(context, widgetId * 10, open,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        manager.updateAppWidget(widgetId, views);
    }

    /** 달력 42칸: 날짜 숫자 + 사람 색 점 + 계획 동그라미 + 오늘 칠 */
    private void drawGrid(Context context, RemoteViews views, Calendar today, JSONObject days) {
        int[] cells = isBig() ? BIG_CELL_IDS : CELL_IDS;
        int[][] dots = isBig() ? BIG_DOT_IDS : DOT_IDS;
        int[] plans = isBig() ? BIG_PLAN_IDS : PLAN_IDS;

        Calendar first = (Calendar) today.clone();
        first.set(Calendar.DAY_OF_MONTH, 1);
        int lead = first.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY;
        int lastDay = today.getActualMaximum(Calendar.DAY_OF_MONTH);
        int todayDay = today.get(Calendar.DAY_OF_MONTH);
        String monthPrefix = String.format(Locale.KOREA, "%d-%02d-",
                today.get(Calendar.YEAR), today.get(Calendar.MONTH) + 1);

        // 주 줄은 남는 높이를 나눠 갖는다 — 5주로 끝나는 달은 6번째 줄을 숨겨 칸을 키운다.
        views.setViewVisibility(isBig() ? R.id.big_week_5 : R.id.week_5,
                lead + lastDay > 35 ? View.VISIBLE : View.GONE);

        for (int i = 0; i < cells.length; i++) {
            int dayNum = i - lead + 1;
            boolean inMonth = dayNum >= 1 && dayNum <= lastDay;

            if (!inMonth) {
                views.setTextViewText(cells[i], "");
                views.setInt(cells[i], "setBackgroundResource", 0);
                views.setViewVisibility(plans[i], View.GONE);
                for (int k = 0; k < 3; k++) views.setViewVisibility(dots[i][k], View.GONE);
                continue;
            }

            views.setTextViewText(cells[i], String.valueOf(dayNum));
            views.setInt(cells[i], "setBackgroundResource",
                    dayNum == todayDay ? R.drawable.widget_day_today : 0);

            JSONObject cell = days == null ? null
                    : days.optJSONObject(monthPrefix + String.format(Locale.KOREA, "%02d", dayNum));
            JSONArray colors = cell == null ? null : cell.optJSONArray("dots");
            boolean planned = cell != null && cell.optBoolean("planned", false);

            views.setViewVisibility(plans[i], planned ? View.VISIBLE : View.GONE);

            // 같은 사람이 하루에 두 번 해도 점은 하나(앱과 같게 — 점은 "요리 수"가 아니라 "요리한 사람")
            List<String> uniq = new ArrayList<>();
            for (int k = 0; colors != null && k < colors.length(); k++) {
                String c = colors.optString(k);
                if (!uniq.contains(c)) uniq.add(c);
            }
            for (int k = 0; k < 3; k++) {
                if (k < uniq.size()) {
                    views.setViewVisibility(dots[i][k], View.VISIBLE);
                    views.setInt(dots[i][k], "setColorFilter", parseColor(uniq.get(k), Color.GRAY));
                } else {
                    views.setViewVisibility(dots[i][k], View.GONE);
                }
            }
        }
    }

    /**
     * 목표 게이지 — 마이캘린더처럼 **식구별 색으로 나눠** 칠한다(범례와 같은 순서로 앞에서부터).
     * RemoteViews 는 자식 뷰의 폭을 비율로 줄 수 없어서(ProgressBar 는 색이 하나뿐) 비트맵으로 그린다.
     * 실제 폭으로 그려야 양 끝 둥근 모양이 늘어나 찌그러지지 않는다.
     */
    private Bitmap gaugeBitmap(Context context, JSONObject snap, Integer goal, int widthPx) {
        final int W = Math.max(widthPx, 1), H = dp(context, 8);
        Bitmap bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float radius = H / 2f;

        paint.setColor(context.getColor(R.color.widget_track));
        canvas.drawRoundRect(new RectF(0, 0, W, H), radius, radius, paint);
        if (goal == null || goal <= 0) return bmp;

        // 둥근 막대 모양으로 잘라 두고 그 안에 조각을 사각형으로 칠한다
        android.graphics.Path clip = new android.graphics.Path();
        clip.addRoundRect(new RectF(0, 0, W, H), radius, radius, android.graphics.Path.Direction.CW);
        canvas.clipPath(clip);

        JSONArray members = snap == null ? null : snap.optJSONArray("members");
        float x = 0f;
        for (int i = 0; members != null && i < members.length() && x < W; i++) {
            JSONObject m = members.optJSONObject(i);
            if (m == null) continue;
            float w = Math.min(W - x, W * (m.optInt("count", 0) / (float) goal));
            if (w <= 0) continue;
            paint.setColor(parseColor(m.optString("color"), 0xFFFFD600));
            canvas.drawRect(x, 0, x + w, H, paint);
            x += w;
        }
        return bmp;
    }

    /**
     * 범례 — 「● 나 6  ● 엄마 3  ● 동생 2  ○ 계획」. 앱 마이캘린더와 같은 규칙(2026-09-23 사용자와 정함):
     *   · 순서는 요약본 순서 그대로 = 이번 달 많이 한 순, 같으면 나 먼저(앱 `orderForLegend`)
     *   · 0회인 사람은 요약본에 없다
     *   · 폭에 맞춰 **두 줄까지**, 넘치면 앞에서부터 들어가는 만큼만 보이고 「외 N명」(누르면 앱에서 전부)
     * RemoteViews 는 줄바꿈 배치를 못 해서 비트맵으로 그린다.
     */
    private Bitmap legendBitmap(Context context, JSONObject snap, int widthPx) {
        final int W = Math.max(widthPx, 1);
        final int lineH = dp(context, 16), gap = dp(context, 10), dotD = dp(context, 7), dotGap = dp(context, 4);
        final int maxLines = 2;

        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 10.5f,
                context.getResources().getDisplayMetrics()));
        text.setColor(context.getColor(R.color.widget_label));
        text.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL)); // 위젯 글자와 같은 기본 글꼴

        List<String> names = new ArrayList<>();
        List<Integer> colors = new ArrayList<>();
        JSONArray members = snap == null ? null : snap.optJSONArray("members");
        for (int i = 0; members != null && i < members.length(); i++) {
            JSONObject m = members.optJSONObject(i);
            if (m == null) continue;
            names.add(String.format(Locale.KOREA, "%s %d", m.optString("name", "식구"), m.optInt("count", 0)));
            colors.add(parseColor(m.optString("color"), Color.GRAY));
        }

        // 몇 명까지 넣을 수 있나 — 뒤에 「외 N명」과 「계획」이 같이 들어가야 한다
        int shown = names.size();
        while (shown > 0 && lines(text, names, shown, W, gap, dotD, dotGap) > maxLines) shown--;

        int used = Math.min(maxLines, Math.max(1, lines(text, names, shown, W, gap, dotD, dotGap)));
        Bitmap bmp = Bitmap.createBitmap(W, lineH * used, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);
        Drawable planMark = context.getDrawable(R.drawable.widget_plan_circle);
        Paint.FontMetrics fm = text.getFontMetrics();

        float x = 0;
        int line = 0;
        int count = shown + (shown < names.size() ? 1 : 0) + 1;
        for (int i = 0; i < count; i++) {
            boolean person = i < shown;
            boolean more = !person && shown < names.size() && i == shown;
            String label = person ? names.get(i) : more ? String.format(Locale.KOREA, "외 %d명", names.size() - shown) : "계획";
            float w = itemWidth(text, label, !more, dotD, dotGap);
            if (x > 0 && x + w > W) {
                line++;
                x = 0;
            }
            float cy = line * lineH + lineH / 2f;
            if (person) {
                dot.setColor(colors.get(i));
                canvas.drawCircle(x + dotD / 2f, cy, dotD / 2f, dot);
            } else if (!more && planMark != null) {
                int mw = dotD + dp(context, 2), mh = dotD + dp(context, 1);
                planMark.setBounds((int) x, (int) (cy - mh / 2f), (int) x + mw, (int) (cy + mh / 2f));
                planMark.draw(canvas);
            }
            float tx = more ? x : x + dotD + dotGap;
            canvas.drawText(label, tx, cy - (fm.ascent + fm.descent) / 2f, text);
            x += w + gap;
        }
        return bmp;
    }

    /** 앞에서 shown 명 + (「외 N명」) + 「계획」을 늘어놓으면 몇 줄이 되나 */
    private int lines(Paint text, List<String> names, int shown, int W, int gap, int dotD, int dotGap) {
        List<Float> widths = new ArrayList<>();
        for (int i = 0; i < shown; i++) widths.add(itemWidth(text, names.get(i), true, dotD, dotGap));
        if (shown < names.size())
            widths.add(itemWidth(text, String.format(Locale.KOREA, "외 %d명", names.size() - shown), false, dotD, dotGap));
        widths.add(itemWidth(text, "계획", true, dotD, dotGap));
        int lines = 1;
        float x = 0;
        for (float w : widths) {
            if (x > 0 && x + w > W) {
                lines++;
                x = 0;
            }
            x += w + gap;
        }
        return lines;
    }

    private float itemWidth(Paint text, String label, boolean withMark, int dotD, int dotGap) {
        return (withMark ? dotD + dotGap : 0) + text.measureText(label);
    }

    /**
     * 「오늘」·「내일」 목록 — 레시피 제목을 **그대로** 보여 준다(요약하지 않는다).
     * 점은 범례와 같은 **꽉 찬 사람 색 점**이고(속 빈 동그라미는 범례에 없는 표식이라 헷갈린다는 지적,
     * 2026-09-23), 이미 한 요리는 끝에 회색 「완료」를 붙인다. 그 구간의 항목 수를 돌려준다.
     */
    private int drawDayList(RemoteViews views, JSONObject snap, String when,
                            int[] rows, int[] dots, int[] texts, int[] doneTags, int emptyId) {
        JSONArray items = snap == null ? null : snap.optJSONArray("upcoming");
        List<JSONObject> mine = new ArrayList<>();
        for (int j = 0; items != null && j < items.length(); j++) {
            JSONObject cand = items.optJSONObject(j);
            if (cand != null && when.equals(cand.optString("when"))) mine.add(cand);
        }
        for (int i = 0; i < rows.length; i++) {
            if (i >= mine.size()) {
                views.setViewVisibility(rows[i], View.GONE);
                continue;
            }
            JSONObject it = mine.get(i);
            views.setViewVisibility(rows[i], View.VISIBLE);
            views.setInt(dots[i], "setColorFilter", parseColor(it.optString("color"), Color.GRAY));
            views.setTextViewText(texts[i], it.optString("title", ""));
            views.setViewVisibility(doneTags[i], "done".equals(it.optString("kind")) ? View.VISIBLE : View.GONE);
        }
        views.setViewVisibility(emptyId, mine.isEmpty() ? View.VISIBLE : View.GONE);
        return mine.size();
    }

    /** 4×2 와 4×3 은 같은 이름의 뷰를 쓰되 id 앞머리만 다르다(small_/big_). */
    private int res(String prefix, String name) {
        boolean big = "big".equals(prefix);
        switch (name) {
            case "gauge": return big ? R.id.big_gauge : R.id.small_gauge;
            case "progress_text": return big ? R.id.big_progress_text : R.id.small_progress_text;
            case "legend": return big ? R.id.big_legend : R.id.small_legend;
            default: return big ? R.id.big_savings : R.id.small_savings;
        }
    }

    private static int dp(Context context, float v) {
        return Math.round(v * context.getResources().getDisplayMetrics().density);
    }

    private int parseColor(String value, int fallback) {
        try {
            return Color.parseColor(value);
        } catch (Exception e) {
            return fallback;
        }
    }

    static {
        int[][] small = {
            { R.id.cell_0, R.id.plan_0, R.id.dot_0_0, R.id.dot_0_1, R.id.dot_0_2 },
            { R.id.cell_1, R.id.plan_1, R.id.dot_1_0, R.id.dot_1_1, R.id.dot_1_2 },
            { R.id.cell_2, R.id.plan_2, R.id.dot_2_0, R.id.dot_2_1, R.id.dot_2_2 },
            { R.id.cell_3, R.id.plan_3, R.id.dot_3_0, R.id.dot_3_1, R.id.dot_3_2 },
            { R.id.cell_4, R.id.plan_4, R.id.dot_4_0, R.id.dot_4_1, R.id.dot_4_2 },
            { R.id.cell_5, R.id.plan_5, R.id.dot_5_0, R.id.dot_5_1, R.id.dot_5_2 },
            { R.id.cell_6, R.id.plan_6, R.id.dot_6_0, R.id.dot_6_1, R.id.dot_6_2 },
            { R.id.cell_7, R.id.plan_7, R.id.dot_7_0, R.id.dot_7_1, R.id.dot_7_2 },
            { R.id.cell_8, R.id.plan_8, R.id.dot_8_0, R.id.dot_8_1, R.id.dot_8_2 },
            { R.id.cell_9, R.id.plan_9, R.id.dot_9_0, R.id.dot_9_1, R.id.dot_9_2 },
            { R.id.cell_10, R.id.plan_10, R.id.dot_10_0, R.id.dot_10_1, R.id.dot_10_2 },
            { R.id.cell_11, R.id.plan_11, R.id.dot_11_0, R.id.dot_11_1, R.id.dot_11_2 },
            { R.id.cell_12, R.id.plan_12, R.id.dot_12_0, R.id.dot_12_1, R.id.dot_12_2 },
            { R.id.cell_13, R.id.plan_13, R.id.dot_13_0, R.id.dot_13_1, R.id.dot_13_2 },
            { R.id.cell_14, R.id.plan_14, R.id.dot_14_0, R.id.dot_14_1, R.id.dot_14_2 },
            { R.id.cell_15, R.id.plan_15, R.id.dot_15_0, R.id.dot_15_1, R.id.dot_15_2 },
            { R.id.cell_16, R.id.plan_16, R.id.dot_16_0, R.id.dot_16_1, R.id.dot_16_2 },
            { R.id.cell_17, R.id.plan_17, R.id.dot_17_0, R.id.dot_17_1, R.id.dot_17_2 },
            { R.id.cell_18, R.id.plan_18, R.id.dot_18_0, R.id.dot_18_1, R.id.dot_18_2 },
            { R.id.cell_19, R.id.plan_19, R.id.dot_19_0, R.id.dot_19_1, R.id.dot_19_2 },
            { R.id.cell_20, R.id.plan_20, R.id.dot_20_0, R.id.dot_20_1, R.id.dot_20_2 },
            { R.id.cell_21, R.id.plan_21, R.id.dot_21_0, R.id.dot_21_1, R.id.dot_21_2 },
            { R.id.cell_22, R.id.plan_22, R.id.dot_22_0, R.id.dot_22_1, R.id.dot_22_2 },
            { R.id.cell_23, R.id.plan_23, R.id.dot_23_0, R.id.dot_23_1, R.id.dot_23_2 },
            { R.id.cell_24, R.id.plan_24, R.id.dot_24_0, R.id.dot_24_1, R.id.dot_24_2 },
            { R.id.cell_25, R.id.plan_25, R.id.dot_25_0, R.id.dot_25_1, R.id.dot_25_2 },
            { R.id.cell_26, R.id.plan_26, R.id.dot_26_0, R.id.dot_26_1, R.id.dot_26_2 },
            { R.id.cell_27, R.id.plan_27, R.id.dot_27_0, R.id.dot_27_1, R.id.dot_27_2 },
            { R.id.cell_28, R.id.plan_28, R.id.dot_28_0, R.id.dot_28_1, R.id.dot_28_2 },
            { R.id.cell_29, R.id.plan_29, R.id.dot_29_0, R.id.dot_29_1, R.id.dot_29_2 },
            { R.id.cell_30, R.id.plan_30, R.id.dot_30_0, R.id.dot_30_1, R.id.dot_30_2 },
            { R.id.cell_31, R.id.plan_31, R.id.dot_31_0, R.id.dot_31_1, R.id.dot_31_2 },
            { R.id.cell_32, R.id.plan_32, R.id.dot_32_0, R.id.dot_32_1, R.id.dot_32_2 },
            { R.id.cell_33, R.id.plan_33, R.id.dot_33_0, R.id.dot_33_1, R.id.dot_33_2 },
            { R.id.cell_34, R.id.plan_34, R.id.dot_34_0, R.id.dot_34_1, R.id.dot_34_2 },
            { R.id.cell_35, R.id.plan_35, R.id.dot_35_0, R.id.dot_35_1, R.id.dot_35_2 },
            { R.id.cell_36, R.id.plan_36, R.id.dot_36_0, R.id.dot_36_1, R.id.dot_36_2 },
            { R.id.cell_37, R.id.plan_37, R.id.dot_37_0, R.id.dot_37_1, R.id.dot_37_2 },
            { R.id.cell_38, R.id.plan_38, R.id.dot_38_0, R.id.dot_38_1, R.id.dot_38_2 },
            { R.id.cell_39, R.id.plan_39, R.id.dot_39_0, R.id.dot_39_1, R.id.dot_39_2 },
            { R.id.cell_40, R.id.plan_40, R.id.dot_40_0, R.id.dot_40_1, R.id.dot_40_2 },
            { R.id.cell_41, R.id.plan_41, R.id.dot_41_0, R.id.dot_41_1, R.id.dot_41_2 },
        };
        int[][] big = {
            { R.id.big_cell_0, R.id.big_plan_0, R.id.big_dot_0_0, R.id.big_dot_0_1, R.id.big_dot_0_2 },
            { R.id.big_cell_1, R.id.big_plan_1, R.id.big_dot_1_0, R.id.big_dot_1_1, R.id.big_dot_1_2 },
            { R.id.big_cell_2, R.id.big_plan_2, R.id.big_dot_2_0, R.id.big_dot_2_1, R.id.big_dot_2_2 },
            { R.id.big_cell_3, R.id.big_plan_3, R.id.big_dot_3_0, R.id.big_dot_3_1, R.id.big_dot_3_2 },
            { R.id.big_cell_4, R.id.big_plan_4, R.id.big_dot_4_0, R.id.big_dot_4_1, R.id.big_dot_4_2 },
            { R.id.big_cell_5, R.id.big_plan_5, R.id.big_dot_5_0, R.id.big_dot_5_1, R.id.big_dot_5_2 },
            { R.id.big_cell_6, R.id.big_plan_6, R.id.big_dot_6_0, R.id.big_dot_6_1, R.id.big_dot_6_2 },
            { R.id.big_cell_7, R.id.big_plan_7, R.id.big_dot_7_0, R.id.big_dot_7_1, R.id.big_dot_7_2 },
            { R.id.big_cell_8, R.id.big_plan_8, R.id.big_dot_8_0, R.id.big_dot_8_1, R.id.big_dot_8_2 },
            { R.id.big_cell_9, R.id.big_plan_9, R.id.big_dot_9_0, R.id.big_dot_9_1, R.id.big_dot_9_2 },
            { R.id.big_cell_10, R.id.big_plan_10, R.id.big_dot_10_0, R.id.big_dot_10_1, R.id.big_dot_10_2 },
            { R.id.big_cell_11, R.id.big_plan_11, R.id.big_dot_11_0, R.id.big_dot_11_1, R.id.big_dot_11_2 },
            { R.id.big_cell_12, R.id.big_plan_12, R.id.big_dot_12_0, R.id.big_dot_12_1, R.id.big_dot_12_2 },
            { R.id.big_cell_13, R.id.big_plan_13, R.id.big_dot_13_0, R.id.big_dot_13_1, R.id.big_dot_13_2 },
            { R.id.big_cell_14, R.id.big_plan_14, R.id.big_dot_14_0, R.id.big_dot_14_1, R.id.big_dot_14_2 },
            { R.id.big_cell_15, R.id.big_plan_15, R.id.big_dot_15_0, R.id.big_dot_15_1, R.id.big_dot_15_2 },
            { R.id.big_cell_16, R.id.big_plan_16, R.id.big_dot_16_0, R.id.big_dot_16_1, R.id.big_dot_16_2 },
            { R.id.big_cell_17, R.id.big_plan_17, R.id.big_dot_17_0, R.id.big_dot_17_1, R.id.big_dot_17_2 },
            { R.id.big_cell_18, R.id.big_plan_18, R.id.big_dot_18_0, R.id.big_dot_18_1, R.id.big_dot_18_2 },
            { R.id.big_cell_19, R.id.big_plan_19, R.id.big_dot_19_0, R.id.big_dot_19_1, R.id.big_dot_19_2 },
            { R.id.big_cell_20, R.id.big_plan_20, R.id.big_dot_20_0, R.id.big_dot_20_1, R.id.big_dot_20_2 },
            { R.id.big_cell_21, R.id.big_plan_21, R.id.big_dot_21_0, R.id.big_dot_21_1, R.id.big_dot_21_2 },
            { R.id.big_cell_22, R.id.big_plan_22, R.id.big_dot_22_0, R.id.big_dot_22_1, R.id.big_dot_22_2 },
            { R.id.big_cell_23, R.id.big_plan_23, R.id.big_dot_23_0, R.id.big_dot_23_1, R.id.big_dot_23_2 },
            { R.id.big_cell_24, R.id.big_plan_24, R.id.big_dot_24_0, R.id.big_dot_24_1, R.id.big_dot_24_2 },
            { R.id.big_cell_25, R.id.big_plan_25, R.id.big_dot_25_0, R.id.big_dot_25_1, R.id.big_dot_25_2 },
            { R.id.big_cell_26, R.id.big_plan_26, R.id.big_dot_26_0, R.id.big_dot_26_1, R.id.big_dot_26_2 },
            { R.id.big_cell_27, R.id.big_plan_27, R.id.big_dot_27_0, R.id.big_dot_27_1, R.id.big_dot_27_2 },
            { R.id.big_cell_28, R.id.big_plan_28, R.id.big_dot_28_0, R.id.big_dot_28_1, R.id.big_dot_28_2 },
            { R.id.big_cell_29, R.id.big_plan_29, R.id.big_dot_29_0, R.id.big_dot_29_1, R.id.big_dot_29_2 },
            { R.id.big_cell_30, R.id.big_plan_30, R.id.big_dot_30_0, R.id.big_dot_30_1, R.id.big_dot_30_2 },
            { R.id.big_cell_31, R.id.big_plan_31, R.id.big_dot_31_0, R.id.big_dot_31_1, R.id.big_dot_31_2 },
            { R.id.big_cell_32, R.id.big_plan_32, R.id.big_dot_32_0, R.id.big_dot_32_1, R.id.big_dot_32_2 },
            { R.id.big_cell_33, R.id.big_plan_33, R.id.big_dot_33_0, R.id.big_dot_33_1, R.id.big_dot_33_2 },
            { R.id.big_cell_34, R.id.big_plan_34, R.id.big_dot_34_0, R.id.big_dot_34_1, R.id.big_dot_34_2 },
            { R.id.big_cell_35, R.id.big_plan_35, R.id.big_dot_35_0, R.id.big_dot_35_1, R.id.big_dot_35_2 },
            { R.id.big_cell_36, R.id.big_plan_36, R.id.big_dot_36_0, R.id.big_dot_36_1, R.id.big_dot_36_2 },
            { R.id.big_cell_37, R.id.big_plan_37, R.id.big_dot_37_0, R.id.big_dot_37_1, R.id.big_dot_37_2 },
            { R.id.big_cell_38, R.id.big_plan_38, R.id.big_dot_38_0, R.id.big_dot_38_1, R.id.big_dot_38_2 },
            { R.id.big_cell_39, R.id.big_plan_39, R.id.big_dot_39_0, R.id.big_dot_39_1, R.id.big_dot_39_2 },
            { R.id.big_cell_40, R.id.big_plan_40, R.id.big_dot_40_0, R.id.big_dot_40_1, R.id.big_dot_40_2 },
            { R.id.big_cell_41, R.id.big_plan_41, R.id.big_dot_41_0, R.id.big_dot_41_1, R.id.big_dot_41_2 },
        };
        for (int i = 0; i < 42; i++) {
            CELL_IDS[i] = small[i][0];
            PLAN_IDS[i] = small[i][1];
            DOT_IDS[i][0] = small[i][2];
            DOT_IDS[i][1] = small[i][3];
            DOT_IDS[i][2] = small[i][4];
            BIG_CELL_IDS[i] = big[i][0];
            BIG_PLAN_IDS[i] = big[i][1];
            BIG_DOT_IDS[i][0] = big[i][2];
            BIG_DOT_IDS[i][1] = big[i][3];
            BIG_DOT_IDS[i][2] = big[i][4];
        }
    }
}
