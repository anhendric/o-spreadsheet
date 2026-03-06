import { StoreConstructor } from "@odoo/o-spreadsheet-engine/types/store_engine";
import { DependencyContainer } from "./dependency_container";

export class ScopedDependencyContainer extends DependencyContainer {
  constructor(
    private parent: DependencyContainer,
    private isolatedStores: Set<StoreConstructor<any>>
  ) {
    super();
  }

  get<T>(Store: StoreConstructor<T>): T {
    if (this.isolatedStores.has(Store)) {
      return super.get(Store);
    }
    return this.parent.get(Store);
  }

  getOwningContainer<T>(Store: StoreConstructor<T>): DependencyContainer {
    if (this.isolatedStores.has(Store)) {
      return this;
    }
    return this.parent.getOwningContainer(Store);
  }
}
