import { createRoot } from "@cdd-team/react";
import { create } from "@cdd-team/zustand";

const useCounter = create<{ count: number }>()(() => ({ count: 0 }));

function Counter() {
	const count = useCounter((state) => state.count);
	return <p>{count}</p>;
}

createRoot(document.body).render(<Counter />);
