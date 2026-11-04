import type { DataSource } from './datasource'
import type { GroupObj, LabelObject } from './objects'

interface SharedHolder {
  source?: DataSource
  subSources?: DataSource[]
}

/**
 * 共享变量以「最后一次保存」为准：
 * 保存某个对象时，把它的同名共享数据源同步到文档里其它对象——
 * 主数据源同步主数据源，子串共享名同步子串共享名。
 *
 * 例：A 的主数据源是键盘输入 `haha`，B 后改为数据库字段 `haha` 并保存，
 * 则 A 的主数据源也变成 B 的数据库绑定。只同步同角色，不改变对象结构。
 */
export function propagateSharedSources(objects: readonly LabelObject[], saved: LabelObject): LabelObject[] {
  const holder = saved as SharedHolder
  const main = holder.source?.sharedName ? holder.source : undefined
  const subs = new Map<string, DataSource>()
  for (const sub of holder.subSources ?? []) {
    if (sub.sharedName) subs.set(sub.sharedName, sub)
  }
  if (!main && subs.size === 0) return objects as LabelObject[]

  const visit = (object: LabelObject): LabelObject => {
    if (object.id === saved.id) return object
    if (object.type === 'group') {
      const children = object.children.map(visit)
      if (children.every((child, index) => child === object.children[index])) return object
      return { ...object, children } as GroupObj
    }
    type Leaf = Exclude<LabelObject, GroupObj>
    const target = object as Leaf & SharedHolder
    let next: Leaf = target
    if (main && target.source?.sharedName === main.sharedName) {
      next = { ...next, source: { ...main } } as Leaf
    }
    const currentSubs = (next as Leaf & SharedHolder).subSources
    if (subs.size && currentSubs?.some((sub: DataSource) => sub.sharedName && subs.has(sub.sharedName))) {
      next = {
        ...next,
        subSources: currentSubs.map((sub: DataSource) => (sub.sharedName && subs.has(sub.sharedName) ? { ...subs.get(sub.sharedName)! } : sub))
      } as Leaf
    }
    return next
  }

  const mapped = objects.map(visit)
  return mapped.some((object, index) => object !== objects[index]) ? mapped : (objects as LabelObject[])
}
