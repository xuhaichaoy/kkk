# 公共组件使用指南

本项目已成功提取了多个可复用的公共组件，提高了代码的可维护性和复用性。

## 已提取的公共组件

### 1. UI基础组件

#### LoadingSpinner - 加载指示器
```tsx
import { LoadingSpinner } from '../components/common';

// 基础使用
<LoadingSpinner message="正在处理..." />

// 不同尺寸
<LoadingSpinner message="处理中..." size="small" />
<LoadingSpinner message="处理中..." size="large" />
```

#### ErrorAlert - 错误提示
```tsx
import { ErrorAlert } from '../components/common';

// 基础使用
<ErrorAlert error={errorMessage} />

// 自定义样式
<ErrorAlert 
  error={errorMessage} 
  severity="warning"
  title="警告"
  closable={true}
  onClose={() => setError(null)}
/>
```

#### EmptyState - 空状态
```tsx
import { EmptyState } from '../components/common';
import { UploadFileIcon } from '@mui/icons-material';

<EmptyState
  icon={<UploadFileIcon sx={{ fontSize: 64 }} />}
  title="暂无数据"
  description="请先上传Excel文件"
  action={<Button variant="contained">上传文件</Button>}
/>
```

### 2. 布局组件

#### PageHeader - 页面头部
```tsx
import { PageHeader } from '../components/common';

<PageHeader
  title="Excel 数据处理"
  subtitle="支持大文件处理，多sheet页面，自动识别表头"
  gradient={true}
  align="left"
  action={<Button variant="contained">操作按钮</Button>}
/>
```

#### CardContainer - 卡片容器
```tsx
import { CardContainer } from '../components/common';

<CardContainer
  elevation={2}
  padding={3}
  minHeight="500px"
  variant="elevated"
>
  <YourContent />
</CardContainer>
```

### 3. 数据展示组件

#### DataTable - 数据表格
```tsx
import { DataTable } from '../components/common';

const columns = [
  { field: 'id', headerName: 'ID', width: 90 },
  { field: 'name', headerName: '姓名', width: 150 },
];

const rows = [
  { id: 1, name: '张三' },
  { id: 2, name: '李四' },
];

<DataTable
  rows={rows}
  columns={columns}
  enableSelection={true}
  enableAdd={true}
  enableDelete={true}
  enableExport={true}
  onAdd={() => console.log('添加行')}
  onDelete={(selectedRows) => console.log('删除行', selectedRows)}
  onExport={() => console.log('导出数据')}
  onRowUpdate={(updatedRow, originalRow) => {
    // 处理行更新
    return updatedRow;
  }}
/>
```

#### CustomTabs - 自定义标签页
```tsx
import { CustomTabs, TabItem } from '../components/common';

const tabs: TabItem[] = [
  {
    label: 'Sheet1',
    badge: '100行',
    content: <DataTable rows={rows1} columns={columns} />
  },
  {
    label: 'Sheet2',
    badge: '50行',
    content: <DataTable rows={rows2} columns={columns} />
  }
];

<CustomTabs
  tabs={tabs}
  value={currentTab}
  onChange={(event, newValue) => setCurrentTab(newValue)}
/>
```

#### FileInfo - 文件信息显示
```tsx
import { FileInfo } from '../components/common';

// 默认样式
<FileInfo file={selectedFile} />

// 紧凑样式
<FileInfo file={selectedFile} variant="compact" />

// 详细样式
<FileInfo 
  file={selectedFile} 
  variant="detailed"
  showSize={true}
  showType={true}
  showLastModified={true}
/>
```

## 重构前后对比

### 重构前的问题
1. **代码重复**: ExcelViewer组件中包含大量重复的UI代码
2. **职责不清**: 组件既负责数据处理又负责UI展示
3. **难以复用**: 特定功能绑定在特定组件中
4. **维护困难**: 修改样式需要修改多个地方

### 重构后的优势
1. **代码复用**: 公共组件可在多个页面使用
2. **职责分离**: 每个组件职责单一，易于测试
3. **易于维护**: 样式和逻辑集中管理
4. **类型安全**: 完整的TypeScript类型定义
5. **一致性**: 统一的UI风格和交互体验

## 使用建议

1. **优先使用公共组件**: 新功能开发时优先考虑使用现有公共组件
2. **按需导入**: 只导入需要的组件，避免不必要的打包体积
3. **扩展组件**: 如需新功能，优先考虑扩展现有组件而非创建新组件
4. **保持一致性**: 使用统一的组件API和样式规范

## 组件设计原则

1. **单一职责**: 每个组件只负责一个功能
2. **可配置性**: 通过props提供灵活的配置选项
3. **类型安全**: 完整的TypeScript类型定义
4. **可访问性**: 支持键盘导航和屏幕阅读器
5. **响应式**: 适配不同屏幕尺寸
6. **性能优化**: 使用React.memo和useCallback优化性能
