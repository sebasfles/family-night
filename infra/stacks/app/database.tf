locals {
  tables = {
    players       = { hash_key = "playerId", range_key = null, permanent = true }
    player_names  = { hash_key = "name", range_key = null, permanent = true }
    rooms         = { hash_key = "roomCode", range_key = null, permanent = false }
    room_members  = { hash_key = "roomCode", range_key = "playerId", permanent = false }
    matches       = { hash_key = "roomCode", range_key = "matchId", permanent = false }
    match_secrets = { hash_key = "matchId", range_key = "playerId", permanent = false }
    votes         = { hash_key = "matchId", range_key = "roundVoter", permanent = false }
  }
}

module "tables" {
  source   = "../../modules/aws/dynamodb_table"
  for_each = local.tables

  name       = "${local.name_prefix}-${replace(each.key, "_", "-")}"
  hash_key   = each.value.hash_key
  range_key  = each.value.range_key
  attributes = { for key in compact([each.value.hash_key, each.value.range_key]) : key => "S" }

  point_in_time_recovery = each.value.permanent
  deletion_protection    = each.value.permanent
  ttl_attribute          = each.value.permanent ? null : "ttl"
}
