'use strict'

const path = require('path')
const config = require(path.join(__dirname, '/../config'))
const GitHub = require(path.join(__dirname, '/../lib/GitHub'))


function _validUsernameAndRepository(username, repository) {
  const allowedUsernames = config.get('allowedUsernames');
  const allowedRepository = config.get('allowedRepositories');

  return (allowedUsernames.length === 0 || allowedUsernames.indexOf(username) > -1) &&
    (allowedRepository.length === 0 || allowedRepository.indexOf(repository) > -1)
}

module.exports = (req, res) => {
  if (!_validUsernameAndRepository(req.params.username, req.params.repository)){
    return res.status(403).end();
  }

  const ua = config.get('analytics.uaTrackingId')
    ? require('universal-analytics')(config.get('analytics.uaTrackingId'))
    : null

  const github = new GitHub({
    username: req.params.username,
    repository: req.params.repository,
    branch: req.params.branch,
    token: config.get('githubToken')
  })

  return github.api.repos.listInvitationsForAuthenticatedUser({}).then(({data}) => {
    let invitationId = null

    const invitation = Array.isArray(data) && data.some(invitation => {
      if (invitation.repository.full_name === (req.params.username + '/' + req.params.repository)) {
        invitationId = invitation.id

        return true
      }
    })

    if (!invitation) {
      return res.status(404).send('Invitation not found')
    }

    return github.api.repos.acceptInvitation({
      invitation_id: invitationId
    }).then(response => {
      res.send('OK!')

      if (ua) {
        ua.event('Repositories', 'Connect').send()
      }
    }).catch(err => { // eslint-disable-line handle-callback-err
      res.status(500).send('Error')

      if (ua) {
        ua.event('Repositories', 'Connect error').send()
      }
    })
  })
}
