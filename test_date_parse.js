import { parse, format } from 'date-fns';

const DATE_TIME_INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm";

const parseDateTimeInput = (value) => {
  if (!value) return undefined;
  const parsed = parse(value, DATE_TIME_INPUT_FORMAT, new Date());
  if (Number.isNaN(parsed.getTime())) return undefined;
  console.log('Input:', value);
  console.log('Parsed:', parsed);
  console.log('ISO:', parsed.toISOString());
  return parsed.toISOString();
};

// 测试今天的日期
const today = '2024-10-02T09:54';
console.log('\n=== 测试今天的时间 ===');
parseDateTimeInput(today);

// 测试明天的日期
const tomorrow = '2024-10-03T09:54';
console.log('\n=== 测试明天的时间 ===');
parseDateTimeInput(tomorrow);
