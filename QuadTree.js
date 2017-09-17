"use strict";

import { vec2 } from "gl-matrix";
import AABB from "td-aabb";
import Direction, { directions } from "td-direction";

export default class QuadTree {
  constructor(parent = null, direction) {
    if (parent !== null) {
      this.parent = parent;
      this.aABB = this.parent.aABB.quadrant(direction);
    } else {
      this.aABB = new AABB({ position: vec2.create(), size: 64 });
    }
  }

  insert(entity) {
    if (!this.containsAABB(entity.aABB))
      throw new QuadTree.OutOfBoundInsert(this, entity);
    const containingChildIndex = this.containingChildIndex(entity.aABB);
    if (containingChildIndex === QuadTree.INDEX_NOT_FOUND) {
      this.ensureEntitiesIsDefined();
      this.entities.push(entity);
      entity.parent = this;
      return true;
    } else {
      this.ensureChildIsDefined(containingChildIndex);
      return this.childs[containingChildIndex].insert(entity);
    }
  }

  reduceEntities(callback, result) {
    if (this.hasEntities) result = this.entities.reduce(callback, result);
    if (this.hasChilds)
      result = this.childs.reduce(
        (result, node) => node.reduceEntities(callback, result),
        result
      );
    return result;
  }

  collideAABB(aABB, ignored) {
    if (!this.containsAABB(aABB)) return false;
    const containingChildIndex = this.containingChildIndex(aABB);
    if (
      containingChildIndex !== QuadTree.INDEX_NOT_FOUND &&
      this.hasChild(containingChildIndex)
    ) {
      return this.childs[containingChildIndex].collideAABB(aABB, ignored);
    } else {
      return this.reduceEntities((result, ownEntity) => {
        if (result === true) return result;
        if (ownEntity === ignored) return false;
        return ownEntity.aABB.collideAABB(aABB);
      }, false);
    }
  }

  collide(entity) {
    return this.collideAABB(entity.aABB, entity);
  }

  containingChildIndex(aABB) {
    return directions.reduce((index, direction, directionIndex) => {
      const quadrant = this.aABB.quadrant(directionIndex);
      if (index === QuadTree.INDEX_NOT_FOUND && quadrant.containsAABB(aABB)) {
        return directionIndex;
      } else {
        return index;
      }
    }, QuadTree.INDEX_NOT_FOUND);
  }

  clean() {
    if (this.isRoot || this.hasEntities || this.hasChilds) return;
    const { parent } = this;
    const index = parent.childs.indexOf(this);
    if (index === QuadTree.INDEX_NOT_FOUND) throw new Error();
    delete parent.childs[index];
    parent.clean();
  }

  detachEntity(entity) {
    this.assertHasEntity(entity, this.moveEntity);
    const index = this.entities.indexOf(entity);
    const detachedEntity = this.entities[index];
    this.entities[index].parent = null;
    delete this.entities[index];
    this.clean();
  }

  reinsert(entity, newPosition) {
    const root = this.root;
    this.detachEntity(entity);
    entity.position = newPosition;
    root.insert(entity);
  }

  moveEntity(entity, newPosition) {
    const newAABB = new AABB({ position: newPosition, size: entity.size });
    if (!this.root.containsAABB(newAABB)) return false;
    this.reinsert(entity, newPosition);
    return true;
  }

  ensureEntitiesIsDefined() {
    if (!this.hasEntities && !this.entities)
      Object.defineProperty(this, "entities", { value: [] });
  }

  ensureChildsIsDefined() {
    if (this.isLeaf && !this.childs)
      Object.defineProperty(this, "childs", { value: [] });
  }

  ensureChildIsDefined(childIndex) {
    if (!this.hasChild(childIndex)) {
      this.ensureChildsIsDefined();
      this.childs[childIndex] = new QuadTree(this, childIndex);
    }
  }

  forEach(func) {
    func(this);
    if (this.hasChilds) this.childs.forEach(child => child.forEach(func));
  }

  branchOnly(func) {
    if (this.isLeaf) throw new QuadTree.BranchFunctionOnLeaf(func);
  }

  assertHasEntity(entity, func) {
    if (
      !this.hasEntities ||
      this.entities.indexOf(entity) === QuadTree.INDEX_NOT_FOUND
    )
      throw new QuadTree.EntityNotFound(this, entity, func);
  }

  directionOf(child) {
    this.branchOnly(this.directionOf);
    return this.childs.indexOf(child);
  }

  containsAABB(aABB) {
    return this.aABB.containsAABB(aABB);
  }

  hasChild(childIndex) {
    return this.hasChilds && childIndex in this.childs;
  }

  toString() {
    return `QuadTree${this.isRoot ? " root" : ""}${this.isLeaf
      ? " leaf"
      : " branch"}${this.hasEntities ? " hasEntities" : ""} { position: ${this
      .position}, size: ${this.size}, depth: ${this.depth} }`;
  }

  get size() {
    return this.aABB.size;
  }

  get depth() {
    return this.isRoot ? 0 : this.parent.depth + 1;
  }

  get position() {
    return this.aABB.position;
  }

  get isLeaf() {
    return !this.hasChilds;
  }

  get isRoot() {
    return !this.hasOwnProperty("parent");
  }

  get hasEntities() {
    return (
      this.hasOwnProperty("entities") && Object.keys(this.entities).length > 0
    );
  }

  get hasChilds() {
    return this.hasOwnProperty("childs") && Object.keys(this.childs).length > 0;
  }

  get root() {
    let node = this;
    while (!node.isRoot) node = node.parent;
    return node;
  }

  static get INDEX_NOT_FOUND() {
    return -1;
  }

  static cutFuncName(func) {
    return func.toString().split(" ")[0];
  }

  static get BranchFunctionOnLeaf() {
    return class BranchFunctionOnLeaf extends Error {
      constructor(func) {
        super(
          `Tried to execute the function ${QuadTree.cutFuncName(
            func
          )} on a leaf node`
        );
      }
    };
  }

  static get OutOfBoundInsert() {
    return class OutOfBoundInsert extends Error {
      constructor(node, entity) {
        super(`Tried to insert out-of-bound entity ${entity} in ${node}`);
      }
    };
  }

  static get EntityNotFound() {
    return class EntityNotFound extends Error {
      constructor(node, entity, func) {
        super(
          `Tried to execute ${QuadTree.cutFuncName(
            func
          )} on ${node} which does not contain entity ${entity}`
        );
      }
    };
  }
}
