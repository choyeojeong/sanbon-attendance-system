import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

serve(async (req) => {
  try {
    const { token, title, body } = await req.json();

    console.log("📥 FCM 요청 수신:", { token, title, body });

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: "default",
        priority: "high",
      }),
    });

    const data = await response.json();
    console.log("📤 Expo 전송 결과:", data);

    if (response.status !== 200 || data.data?.status === "error") {
      throw new Error(data.data?.message || "Expo 전송 실패");
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    console.error("❌ 오류 발생:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500 }
    );
  }
});
