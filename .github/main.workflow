workflow "Test" {
  on = "push"
  resolves = ["test"]
}

action "yarn install" {
  uses = "Borales/actions-yarn@7f2a9167277e57a749fc97441aec0056d2b13948"
  args = "install"
}

action "test" {
  uses = "Borales/actions-yarn@7f2a9167277e57a749fc97441aec0056d2b13948"
  args = "test"
  needs = ["yarn install"]
}
