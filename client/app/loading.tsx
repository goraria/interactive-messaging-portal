import { Spinner } from "@gorth/primitive/pattern/spinner"

export default function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Spinner variant="infinite" size={32} />
    </div>
  )
}