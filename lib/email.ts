/**
 * Email transport. Uses Resend when RESEND_API_KEY is set, otherwise
 * logs to stdout (handy for local dev without an outbound account).
 */
import { Resend } from "resend";
import { env } from "@/lib/env";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(args: SendArgs) {
  if (!env.RESEND_API_KEY) {
    console.log("\n─── dev email ───────────────────────────────");
    console.log("to     :", args.to);
    console.log("from   :", env.EMAIL_FROM);
    console.log("subject:", args.subject);
    console.log(args.text ?? stripHtml(args.html));
    console.log("─────────────────────────────────────────────\n");
    return { id: "dev" };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
  if (error) throw new Error(`Email send failed: ${error.message}`);
  return { id: data?.id ?? "sent" };
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
