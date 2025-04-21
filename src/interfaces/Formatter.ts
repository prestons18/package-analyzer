import { FoundComponent } from "./Finder";

export interface Formatter {
  /**
   * Formats the list of found components into an output type.
   */
  format(components: FoundComponent[]): any;
}
