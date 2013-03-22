// --------------------------------------------------------------------------------------------------------------------
// <copyright file="ClientAuthenticationService.cs" company="Exit Games GmbH">
//   Copyright (c) Exit Games GmbH.  All rights reserved.
// </copyright>
// <summary>
//   Defines the ClientAuthenticationService type.
// </summary>
// --------------------------------------------------------------------------------------------------------------------

namespace ExitGames.Web.Sample.Services
{
    public class ClientAuthenticationService : IClientAuthenticationService
    {
        private readonly IUserRepository userRepository;

        public ClientAuthenticationService()
            : this(null)
        {
        }

        public ClientAuthenticationService(IUserRepository repository)
        {
            this.userRepository = repository ?? new UserRepository();
        }

        public bool Authenticate(string userName, string token)
        {
            // TODO use repository to get user and authenticate
            if (userName == token)
            {
                return true;
            }

            return false;
        }
    }
}