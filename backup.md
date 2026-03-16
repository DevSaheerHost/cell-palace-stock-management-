const createGizmosJob = async () => {
  const now = new Date()

const dateKey = now.toLocaleDateString("en-GB").replaceAll("/", "-")
const fullDate = now.toLocaleString("en-GB")


// valifste inputs and then push
await push(ref(db, `gizmos/jobs/${dateKey}`), {

  complaint: "Display",
  device: "Reamle",
  notes: "Combo changed",
  date: fullDate,
  createdAt: Date.now()

})
}

