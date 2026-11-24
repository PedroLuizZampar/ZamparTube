import { imageResponse } from "@/lib/image-response";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return imageResponse("category", (await ctx.params).id);
}
