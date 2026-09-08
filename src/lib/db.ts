import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  messageEmailMiddlewareInstalled?: boolean;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (!globalForPrisma.messageEmailMiddlewareInstalled) {
  prisma.$use(async (params, next) => {
    const result = await next(params);

    if (params.model === "Message" && params.action === "create") {
      try {
        const data = params.args?.data as {
          matchRequestId?: string;
          senderId?: string;
          body?: string;
        };

        if (data.matchRequestId && data.senderId) {
          const thread = await prisma.matchRequest.findUnique({
            where: { id: data.matchRequestId },
            include: {
              requester: { select: { id: true, name: true, email: true } },
              acceptedBy: { select: { id: true, name: true, email: true } },
            },
          });

          if (thread?.acceptedBy) {
            const sender =
              thread.requesterId === data.senderId ? thread.requester : thread.acceptedBy;
            const recipient =
              thread.requesterId === data.senderId ? thread.acceptedBy : thread.requester;

            if (sender?.id === data.senderId && recipient?.email) {
              const [{ sendMail }, { getSettings }] = await Promise.all([
                import("./email"),
                import("./settings"),
              ]);
              const { appUrl } = await getSettings();
              const raw = String(data.body ?? "").trim();
              const preview = raw.length > 240 ? `${raw.slice(0, 237)}...` : raw;

              await sendMail({
                to: recipient.email,
                subject: `Ny besked fra ${sender.name} på RacketBuddy`,
                body: [
                  `Hej ${recipient.name}`,
                  "",
                  `${sender.name} har sendt dig en besked på RacketBuddy.`,
                  "",
                  preview ? `“${preview}”` : "",
                  "",
                  `Læs og svar her: ${appUrl}/beskeder/${thread.id}`,
                  "",
                  "RacketBuddy",
                ]
                  .filter((line, index, arr) => line !== "" || arr[index - 1] !== "")
                  .join("\n"),
              });
            }
          }
        }
      } catch (err) {
        // En mailnotifikation må aldrig få selve beskeden til at fejle.
        console.error("Kunne ikke sende beskednotifikation:", err);
      }
    }

    return result;
  });

  globalForPrisma.messageEmailMiddlewareInstalled = true;
}

export const db = prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
