import { useState } from 'react'
import StudentForm from '../components/StudentForm'
import CameraCapture from '../components/CameraCapture'

export default function EnrollPage() {
  const [studentId, setStudentId] = useState(null)
  return studentId
    ? <CameraCapture studentId={studentId} onComplete={() => setStudentId(null)} />
    : <StudentForm onSuccess={setStudentId} />
}