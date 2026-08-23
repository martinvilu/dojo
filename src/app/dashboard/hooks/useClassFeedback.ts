"use client";

import { useState } from "react";
import { collection, doc, getDoc, getDocs, query, setDoc, where, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

export interface FeedbackStats {
  avgRating: number;
  count: number;
  understandingDist: Record<string, number>;
  comments: string[];
}

interface UseClassFeedbackArgs {
  profile: any;
  selectedCourse: any;
}

/**
 * Anonymous per-class student surveys (1-5 rating, comprehension and
 * comments). The Firestore doc id is a SHA-256 of uid + class so students
 * can re-read their own submission without exposing identity in the doc.
 */
export function useClassFeedback({ profile, selectedCourse }: UseClassFeedbackArgs) {
  const [activeFeedbackClass, setActiveFeedbackClass] = useState<number | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackUnderstanding, setFeedbackUnderstanding] = useState<string>("Entendí todo");
  const [feedbackComment, setFeedbackComment] = useState<string>("");
  const [viewingFeedbackClass, setViewingFeedbackClass] = useState<number | null>(null);  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState<boolean>(false);

  const hashString = async (str: string) => {
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleOpenFeedbackModal = async (classNumber: number) => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid || !profile) return;

    setLoadingFeedback(true);
    setActiveFeedbackClass(classNumber);
    setFeedbackRating(5);
    setFeedbackUnderstanding("Entendí todo");
    setFeedbackComment("");

    try {
      // Check if student already gave feedback by checking document existence
      const docId = await hashString(`${profile.id}_class_${classNumber}`);
      const feedbackDoc = await getDoc(doc(db, "courses", cid, "class_feedback", docId));
      if (feedbackDoc.exists()) {
        const data = feedbackDoc.data();
        setFeedbackRating(data.rating || 5);
        setFeedbackUnderstanding(data.understanding || "Entendí todo");
        setFeedbackComment(data.comment || "");
      }
    } catch (err) {
      console.error("Error checking existing feedback:", err);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleSubmitFeedback = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid || !profile || activeFeedbackClass === null) return;

    setLoadingFeedback(true);
    try {
      const docId = await hashString(`${profile.id}_class_${activeFeedbackClass}`);
      await setDoc(doc(db, "courses", cid, "class_feedback", docId), {
        classNumber: activeFeedbackClass,
        rating: feedbackRating,
        understanding: feedbackUnderstanding,
        comment: feedbackComment,
        created_at: serverTimestamp()
      });
      showToast("¡Feedback enviado de forma anónima! Muchas gracias.", "success");
      setActiveFeedbackClass(null);
    } catch (err: any) {
      showToast("Error al enviar feedback: " + err.message, "error");
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleLoadClassFeedback = async (classNumber: number) => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;

    setLoadingFeedback(true);
    setViewingFeedbackClass(classNumber);
    try {
      const q = query(
        collection(db, "courses", cid, "class_feedback"),
        where("classNumber", "==", classNumber)
      );
      const snap = await getDocs(q);

      let sumRating = 0;
      let feedbackCount = 0;
      const understandingDist: Record<string, number> = {
        "Entendí todo": 0,
        "Entendí la mayor parte": 0,
        "Tengo dudas": 0,
        "No entendí nada": 0
      };
      const comments: string[] = [];

      snap.forEach(docSnap => {
        const data = docSnap.data();
        sumRating += data.rating || 0;
        feedbackCount++;
        if (data.understanding && data.understanding in understandingDist) {
          understandingDist[data.understanding]++;
        }
        if (data.comment && data.comment.trim() !== "") {
          comments.push(data.comment);
        }
      });

      setFeedbackStats({
        avgRating: feedbackCount > 0 ? sumRating / feedbackCount : 0,
        count: feedbackCount,
        understandingDist,
        comments
      });
    } catch (err: any) {
      showToast("Error al cargar feedback: " + err.message, "error");
    } finally {
      setLoadingFeedback(false);
    }
  };

  return {
    activeFeedbackClass,
    setActiveFeedbackClass,
    feedbackRating,
    setFeedbackRating,
    feedbackUnderstanding,
    setFeedbackUnderstanding,
    feedbackComment,
    setFeedbackComment,
    viewingFeedbackClass,
    setViewingFeedbackClass,
    feedbackStats,
    loadingFeedback,
    handleOpenFeedbackModal,
    handleSubmitFeedback,
    handleLoadClassFeedback
  };
}
