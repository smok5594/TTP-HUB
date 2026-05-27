import StudentProfile from "@/components/StudentProfile";

export default async function StudentProfilePage({ params }) {
  const { id } = await params;
  return <StudentProfile id={id} />;
}
