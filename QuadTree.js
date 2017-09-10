"use strict";

import { vec2 } from "gl-matrix";
import AABB from "td-aabb";
import Direction, { directions } from "td-direction";

export default class QuadTree {
  constructor(parent = null) {
    if (parent !== null) {
      this.parent = parent;
    } else {
      this.rootSize = 64;
      this.rootPosition = vec2.create();
    }
  }

  insert(entity) {
    if (!this.containsAABB(entity.aABB))
      throw new QuadTree.OutOfBoundInsert(this, entity);
    const containingChildIndex = this.containingChildIndex(entity.aABB);
    if (containingChildIndex === QuadTree.INDEX_NOT_FOUND) {
      this.push(entity);
    } else {
      this.ensureChildIsDefined(containingChildIndex);
      this.childs[containingChildIndex].insert(entity);
    }
  }

  containingChildIndex(aABB) {
    return directions.reduce((index, direction, directionIndex) => {
      const quartant = this.aABB.quartant(directionIndex);
      if (index === QuadTree.INDEX_NOT_FOUND && quartant.containsAABB(aABB)) {
        return directionIndex;
      } else {
        return index;
      }
    }, QuadTree.INDEX_NOT_FOUND);
  }

  ensureEntitiesIsDefined() {
    if (!this.hasEntities)
      Object.defineProperty(this, "entities", { value: [] });
  }

  ensureChildIsDefined(childIndex) {
    if (this.isLeaf) Object.defineProperty(this, "childs", { value: [] });
    if (!this.hasChild(childIndex))
      this.childs[childIndex] = new QuadTree(this);
  }

  forEach(func) {
    func(this);
    if (this.hasChilds) this.childs.forEach(child => child.forEach(func));
  }

  push(entity) {
    this.ensureEntitiesIsDefined();
    this.entities.push(entity);
  }

  branchOnly() {
    if (this.isLeaf) throw new QuadTree.BranchFunctionOnLeaf(this.directionOf);
  }

  directionOf(child) {
    this.branchOnly();
    return this.childs.indexOf(child);
  }

  positionOf(child) {
    this.branchOnly();
    return this.aABB.quartant(this.directionOf(child)).position;
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
    return this.isRoot ? this.rootSize : this.parent.size / 2;
  }

  get depth() {
    return this.isRoot ? 0 : this.parent.depth + 1;
  }

  get position() {
    return this.isRoot ? this.rootPosition : this.parent.positionOf(this);
  }

  get isLeaf() {
    return !this.hasChilds;
  }

  get isRoot() {
    return !this.hasOwnProperty("parent");
  }

  get aABB() {
    return new AABB({ position: this.position, size: this.size });
  }

  get hasEntities() {
    return this.hasOwnProperty("entities");
  }

  get hasChilds() {
    return this.hasOwnProperty("childs");
  }

  static get INDEX_NOT_FOUND() {
    return -1;
  }

  static get BranchFunctionOnLeaf() {
    return class BranchFunctionOnLeaf extends Error {
      constructor(func) {
        super(
          `Tried to execute the function ${func
            .toString()
            .split(" ")[0]} on a leaf node`
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
}
