async function getTeachrHomePage() {
  try {
    const res = await fetch('http://localhost:5000/api/v1/teacher/home', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    console.log(data);
    return data;
  } catch (error) {
    throw error;
  }
}
export default getTeachrHomePage;
