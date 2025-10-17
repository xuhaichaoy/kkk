import { startOfToday } from "date-fns";
import { useAtom, useAtomValue } from "jotai";
import React, { useState, type FC } from "react";
import TodoCalendar from "../components/todo/TodoCalendar";
import { calendarMonthAtom, todosAtom } from "../stores/todoStore";

const TodoCalendarPage: FC = () => {
  const todos = useAtomValue(todosAtom);
  const [calendarMonth, setCalendarMonth] = useAtom(calendarMonthAtom);
  const [selectedDate, setSelectedDate] = useState(startOfToday());

  return (
    <TodoCalendar
      tasks={todos}
      month={calendarMonth}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      onMonthChange={setCalendarMonth}
    />
  );
};

export default TodoCalendarPage;
