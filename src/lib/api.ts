import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/clientApp";

const apiCall = httpsCallable(functions, "api");

export const api = async (action: string, payload: any = {}) => {
  const res = await apiCall({ action, payload });
  return res.data as any;
};
