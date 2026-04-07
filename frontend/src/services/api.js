import axios from 'axios'

const API = axios.create({
  baseURL: 'http://localhost:8000/api'
})

export const enrollStudent = (data) => API.post('/enroll', data)

export const enrollFace = (studentId, angle, imageBlob) => {
  const form = new FormData()
  form.append('student_id', studentId)
  form.append('angle', angle)
  form.append('image', imageBlob, 'face.jpg')
  return API.post('/enroll/face', form)
}