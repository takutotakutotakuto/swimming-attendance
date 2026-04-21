import type { Metadata } from "next";
import StaffInputForm from "./components/StaffInputForm";

export const metadata: Metadata = {
  manifest: "/manifest.json",
};

export default function StaffInputPage() {
  return <StaffInputForm />;
}
