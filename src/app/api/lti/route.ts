import { POST as launchPost, GET as launchGet } from "./launch/route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return launchPost(request);
}

export async function GET(request: Request) {
  return launchGet(request);
}
